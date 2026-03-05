import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { redisSubscriber } from "./redis.js";

export async function createSSEStream(
	c: Context,
	sessionId: string,
	onEvent?: (event: { type: string }) => void,
) {
	c.header("X-Accel-Buffering", "no");
	c.header("Cache-Control", "no-cache");
	c.header("Content-Type", "text/event-stream");

	return streamSSE(c, async (stream) => {
		const channel = `agent:session:${sessionId}`;
		const subscriber = redisSubscriber.duplicate();

		await subscriber.subscribe(channel);

		let isDone = false;
		const onMessage = async (chan: string, msg: string) => {
			if (chan === channel) {
				await stream.writeSSE({
					data: msg,
				});

				if (onEvent) {
					try {
						const event = JSON.parse(msg);
						onEvent(event);
						if (event.type === "done" || event.type === "error") {
							isDone = true;
						}
					} catch (e) {
						// Ignore parse errors
					}
				}
			}
		};

		subscriber.on("message", onMessage);

		while (!isDone) {
			await new Promise((resolve) => setTimeout(resolve, 500));
			if (c.req.raw.signal.aborted) {
				break;
			}
		}

		await subscriber.unsubscribe(channel);
		await subscriber.quit();
	});
}
