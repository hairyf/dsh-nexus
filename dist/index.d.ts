import { Context } from "@deepseek-ai/cordis";
interface HostOptions {
  dataDir?: string;
  github?: {
    repository: string;
    login: string;
    automationIds?: string[];
  }[];
}
export declare const inject: string[];
export declare function apply(ctx: Context, options?: HostOptions): Promise<void>;
export {};