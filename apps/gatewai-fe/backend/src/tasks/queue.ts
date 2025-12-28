/**
 * A generic queue for unique IDs that prevents duplicates.
 * Uses FIFO (First-In-First-Out) order.
 * IDs can be of any hashable type (e.g., string, number).
 */
export class UniqueIdQueue<T> {
	private readonly queue: T[] = [];
	private readonly uniqueSet: Set<T> = new Set();

	/**
	 * Adds an ID to the queue if it doesn't already exist.
	 * @param id The ID to enqueue.
	 * @returns True if the ID was added, false if it already exists.
	 */
	public enqueue(id: T): boolean {
		if (this.uniqueSet.has(id)) {
			return false;
		}
		this.queue.push(id);
		this.uniqueSet.add(id);
		return true;
	}

	/**
	 * Removes and returns the oldest ID from the queue.
	 * @returns The dequeued ID or undefined if the queue is empty.
	 */
	public dequeue(): T | undefined {
		const id = this.queue.shift();
		if (id !== undefined) {
			this.uniqueSet.delete(id);
		}
		return id;
	}

	/**
	 * Returns the oldest ID without removing it.
	 * @returns The front ID or undefined if the queue is empty.
	 */
	public peek(): T | undefined {
		return this.queue[0];
	}

	/**
	 * Checks if the queue is empty.
	 * @returns True if empty, false otherwise.
	 */
	public isEmpty(): boolean {
		return this.queue.length === 0;
	}

	/**
	 * Returns the number of IDs in the queue.
	 * @returns The size of the queue.
	 */
	public size(): number {
		return this.queue.length;
	}

	/**
	 * Checks if a specific ID exists in the queue.
	 * @param id The ID to check.
	 * @returns True if the ID exists, false otherwise.
	 */
	public has(id: T): boolean {
		return this.uniqueSet.has(id);
	}

	/**
	 * Clears the queue.
	 */
	public clear(): void {
		this.queue.length = 0;
		this.uniqueSet.clear();
	}

	/**
	 * Returns a copy of the current queue as an array.
	 * @returns An array of IDs in queue order.
	 */
	public toArray(): T[] {
		return [...this.queue];
	}
}
