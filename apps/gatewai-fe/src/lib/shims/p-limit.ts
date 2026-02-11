export default function pLimit(_concurrency: number) {
    return async <T>(fn: () => Promise<T>): Promise<T> => {
        return await fn();
    };
}
