import { config } from 'dotenv';
config();

type EnvConfig = {
  PORT: number;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error("Client ID and Secret is not set for google");
}

export const ENV_CONFIG: EnvConfig = {
  PORT: Number(process.env.PORT),
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET
}



type AppConfig = {
  llmModels: string[];
}

export const APP_CONFIG: AppConfig = {
  llmModels: [
    'openai/gpt-5',
    'openai/gpt-4.1',
    'openai/gpt-5.1-instant',
    'openai/gpt-5.1-thinking',
    'openai/gpt-5-codex',
    'xai/grok-4',
    'anthropic/claude-sonnet-4',
    'anthropic/claude-sonnet-4.5',
    'anthropic/claude-haiku-4.5',
    'google/gemini-2.5-flash-lite',
    'google/gemini-2.0-flash',
    'google/gemini-2.5-pro',
    'google/gemini-3-pro-preview',
    'alibaba/qwen3-max',
    'deepseek/deepseek-v3',
  ]
}