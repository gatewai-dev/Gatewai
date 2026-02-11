export const createPool = (factory: any, _opts?: any) => {
    return {
        acquire: async () => {
            return await factory.create();
        },
        release: async (resource: any) => {
            if (factory.destroy) {
                await factory.destroy(resource);
            }
        },
        destroy: async (resource: any) => {
            if (factory.destroy) {
                await factory.destroy(resource);
            }
        },
        validate: async (resource: any) => {
            if (factory.validate) {
                return await factory.validate(resource);
            }
            return true;
        },
        clear: async () => { },
        drain: async () => { },
    };
};
