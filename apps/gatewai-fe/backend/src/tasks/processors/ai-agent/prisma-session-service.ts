import { type Node, prisma } from "@gatewai/db";
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
import { generateId } from "../../../utils/misc.js";

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days in seconds

/**
 * Prisma-based implementation of the SessionService
 **/
export class PrismaSessionService extends BaseSessionService {
	constructor(private nodeId: Node["id"]) {
		super();
	}

	public async createSession(request: CreateSessionRequest): Promise<Session> {
		const { appName, userId, state } = request;
		const sessionId = request.sessionId ?? generateId();

		const now = Date.now();
		const expiredAt = new Date(now + SESSION_TTL * 1000);

		return prisma.$transaction(async (tx) => {
			const existing = await tx.agentSession.count({
				where: { appName, userId, sessionId },
			});

			if (existing > 0) {
				throw new Error(
					`Session with ID '${sessionId}' already exists for app '${appName}' and user '${userId}'.`,
				);
			}

			const session: Session = {
				id: sessionId,
				appName,
				userId,
				state: state ?? {},
				events: [],
				lastUpdateTime: now,
			};

			await tx.agentSession.create({
				data: {
					appName,
					userId,
					nodeId: this.nodeId,
					sessionId,
					state: session.state as unknown as any,
					events: session.events as unknown as any,
					lastUpdateTime: new Date(now),
					expiredAt,
				},
			});

			return { ...session };
		});
	}

	public async getSession(
		request: GetSessionRequest,
	): Promise<Session | undefined> {
		const { appName, userId, sessionId, config } = request;
		console.log({ request });
		const now = new Date();
		const rawSession = await prisma.agentSession.findFirst({
			where: { appName, userId, sessionId },
		});

		if (!rawSession || rawSession.expiredAt < now) return undefined;

		const session: Session = {
			id: sessionId,
			appName,
			userId,
			state: rawSession.state as any,
			events: rawSession.events as any,
			lastUpdateTime: rawSession.lastUpdateTime.getTime(),
		};

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

		const now = new Date();
		const rawSessions = await prisma.agentSession.findMany({
			where: {
				appName,
				userId,
				expiredAt: {
					gt: now,
				},
			},
		});

		const sessions: Session[] = rawSessions.map((raw) => ({
			id: raw.sessionId,
			appName,
			userId,
			state: {},
			events: [],
			lastUpdateTime: raw.lastUpdateTime.getTime(),
		}));

		return { sessions };
	}

	public async deleteSession(request: DeleteSessionRequest): Promise<void> {
		const { appName, userId, sessionId } = request;

		const sessionToDelete = await prisma.agentSession.findFirstOrThrow({
			where: { appName, userId, sessionId },
		});

		if (sessionToDelete) {
			await prisma.agentSession.delete({
				where: { appName_userId_sessionId: { appName, userId, sessionId } },
			});
		}
	}

	public async appendEvent({
		session,
		event,
	}: AppendEventRequest): Promise<Event> {
		const { appName, userId, id: sessionId } = session;

		const now = Date.now();
		const expiredAt = new Date(now + SESSION_TTL * 1000);

		await prisma.$transaction(async (tx) => {
			const rawSession = await tx.agentSession.findFirstOrThrow({
				where: { appName, userId, sessionId },
			});

			const currentTime = new Date();
			if (!rawSession || rawSession.expiredAt < currentTime) {
				throw new Error(`Failed to append event: ERR_SESSION_NOT_FOUND`);
			}

			const state = rawSession.state as Record<string, unknown> as any;
			let events = rawSession.events as any;

			if (event.actions?.stateDelta) {
				for (const [k, v] of Object.entries(event.actions.stateDelta)) {
					if (v === undefined) {
						delete state[k];
					} else {
						state[k] = v;
					}
				}
			}

			events = [...events, event];

			await tx.agentSession.update({
				where: { appName_userId_sessionId: { appName, userId, sessionId } },
				data: {
					state,
					events,
					lastUpdateTime: new Date(now),
					expiredAt,
				},
			});
		});

		return event;
	}
}
