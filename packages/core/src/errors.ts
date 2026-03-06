export class ServiceAbortError extends Error {
	constructor(message = "Operation cancelled") {
		super(message);
		this.name = "AbortError";
	}
}
