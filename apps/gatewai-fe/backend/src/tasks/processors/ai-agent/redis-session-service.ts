import {
	type AppendEventRequest,
	BaseSessionService,
	type CreateSessionRequest,
	type DeleteSessionRequest,
	type Event,
	type GetSessionRequest,
	type ListSessionsRequest,
	type ListSessionsResponse,
	type Session,
} from "@google/adk";
import { Redis } from "ioredis";
import { ENV_CONFIG } from "../../../config.js";
import { generateId } from "../../../utils/misc.js";

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days in seconds

/**
 * Redis-based implementation of the SessionService
 **/
export class RedisSessionService extends BaseSessionService {
	private readonly redis: Redis;

	constructor() {
		super();
		this.redis = new Redis({
			host: ENV_CONFIG.REDIS_HOST,
			port: Number(ENV_CONFIG.REDIS_PORT),
			password: ENV_CONFIG.REDIS_PASSWORD,
			commandTimeout: 5000,
		});
	}

	private getSessionKey(
		appName: string,
		userId: string,
		sessionId: string,
	): string {
		return `session:${appName}:${userId}:${sessionId}`;
	}

	private getListKey(appName: string, userId: string): string {
		return `sessions:list:${appName}:${userId}`;
	}

	public async createSession(request: CreateSessionRequest): Promise<Session> {
		const { appName, userId, state } = request;
		const sessionId = request.sessionId ?? generateId();
		const key = this.getSessionKey(appName, userId, sessionId);
		const listKey = this.getListKey(appName, userId);

		const now = Date.now();
		const session: Session = {
			id: sessionId,
			appName,
			userId,
			state: state ?? {},
			events: [],
			lastUpdateTime: now,
		};

		const json = JSON.stringify(session);

		const result = await this.redis
			.multi()
			.set(key, json, "EX", SESSION_TTL, "NX")
			.sadd(listKey, sessionId)
			.expire(listKey, SESSION_TTL)
			.exec();

		if (result && result[0][1] === null) {
			throw new Error(
				`Session with ID '${sessionId}' already exists for app '${appName}' and user '${userId}'.`,
			);
		}

		return { ...session };
	}

	public async getSession(
		request: GetSessionRequest,
	): Promise<Session | undefined> {
		const { appName, userId, sessionId, config } = request;
		const key = this.getSessionKey(appName, userId, sessionId);

		const json = await this.redis.get(key);
		if (!json) return undefined;

		const session: Session = JSON.parse(json);
		let events = [...session.events];

		if (config?.afterTimestamp !== undefined) {
			// biome-ignore lint/style/noNonNullAssertion: biome bug ?
			events = events.filter(
				(event) => event.timestamp > config.afterTimestamp!,
			);
		}

		if (config?.numRecentEvents !== undefined) {
			events = events.slice(-config.numRecentEvents);
		}

		return {
			...session,
			state: { ...session.state },
			events,
		};
	}

	public async listSessions(
		request: ListSessionsRequest,
	): Promise<ListSessionsResponse> {
		const { appName, userId } = request;
		const listKey = this.getListKey(appName, userId);

		// For large volumes, SSCAN is better, but SMEMBERS is fine for typical user session counts
		const sessionIds = await this.redis.smembers(listKey);

		if (sessionIds.length === 0) {
			return { sessions: [] };
		}

		const pipeline = this.redis.pipeline();
		for (const sid of sessionIds) {
			pipeline.get(this.getSessionKey(appName, userId, sid));
		}
		const results = await pipeline.exec();

		const sessions: Session[] = [];
		for (const [, json] of results ?? []) {
			if (json) {
				const session: Session = JSON.parse(json as string);
				sessions.push({
					id: session.id,
					appName: session.appName,
					userId: session.userId,
					state: {},
					events: [],
					lastUpdateTime: session.lastUpdateTime,
				});
			}
		}

		return { sessions };
	}

	public async deleteSession(request: DeleteSessionRequest): Promise<void> {
		const { appName, userId, sessionId } = request;
		const key = this.getSessionKey(appName, userId, sessionId);
		const listKey = this.getListKey(appName, userId);

		await this.redis.multi().del(key).srem(listKey, sessionId).exec();
	}

	public async appendEvent({
		session,
		event,
	}: AppendEventRequest): Promise<Event> {
		const { appName, userId, id: sessionId } = session;
		const key = this.getSessionKey(appName, userId, sessionId);

		// Sentinel for Lua to handle field deletions safely
		const sentinel = { ___del___: true };
		const preparedEvent = { ...event };

		if (event.actions?.stateDelta) {
			const newDelta: Record<string, unknown> = {};
			for (const [k, v] of Object.entries(event.actions.stateDelta)) {
				newDelta[k] = v === undefined ? sentinel : v;
			}
			preparedEvent.actions = { ...event.actions, stateDelta: newDelta };
		}

		const eventJson = JSON.stringify(preparedEvent);
		const now = Date.now().toString();

		// Use the Lua script to ensure state updates and event appends are atomic
		const result = await this.redis.eval(
			appendLuaScript,
			1,
			key,
			eventJson,
			now,
		);

		if (result !== "OK") {
			throw new Error(`Failed to append event: ${result}`);
		}

		return event;
	}
}

const appendLuaScript = `
local key = KEYS[1]
local event_json = ARGV[1]
local now = tonumber(ARGV[2])

local session_data = redis.call('GET', key)
if not session_data then
  return 'ERR_SESSION_NOT_FOUND'
end

local session = cjson.decode(session_data)
local event = cjson.decode(event_json)

-- Push event to the history
if not session.events then session.events = {} end
table.insert(session.events, event)

-- Apply stateDelta if it exists
if event.actions and event.actions.stateDelta then
  if not session.state then session.state = {} end
  for k, v in pairs(event.actions.stateDelta) do
    if type(v) == 'table' and v.___del___ then
      session.state[k] = nil
    else
      session.state[k] = v
    end
  end
end

session.lastUpdateTime = now

-- Save back with TTL refresh
local updated_json = cjson.encode(session)
redis.call('SET', key, updated_json, 'EX', 2592000)

return 'OK'
`;
