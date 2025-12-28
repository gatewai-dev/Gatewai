import { customAlphabet } from "nanoid";

// Define the base62 alphabet (matches your ID's character set)
const alphabet =
	"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Create a generator for 22-character IDs
const generateId = customAlphabet(alphabet, 22);

export { generateId };
