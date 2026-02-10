import "reflect-metadata";

import { container } from "tsyringe";

/**
 * Initialize the global dependency injection container.
 * This function should be called at the application's entry point.
 */
export function initializeDIContainer() {
    return container;
}

export { container };
