import Redis from "ioredis";
import RedisMock from "ioredis-mock";

class RedisService {
  private client: any;

  constructor() {
    if (process.env.NODE_ENV === "test") {
      this.client = new RedisMock();
    } else {
      this.client = new Redis(
        process.env.REDIS_URL || "redis://localhost:6379"
      );

      this.client.on("error", (err: any) => {
        console.error("Redis Client Error", err);
      });

      this.client.on("connect", () => {
        console.log("Redis Client Connected");
      });
    }
  }

  async set(
    key: string,
    value: string,
    ttlSeconds: number = 300
  ): Promise<void> {
    await this.client.set(key, value, "EX", ttlSeconds);
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async flush(): Promise<void> {
    await this.client.flushall();
  }

  async deletePattern(pattern: string): Promise<void> {
    // Scan and delete is safer for prod, but keys usually behaves fine for small scale.
    // ioredis stream scan is better.
    const stream = this.client.scanStream({
      match: pattern,
      count: 100,
    });

    stream.on("data", async (keys: string[]) => {
      if (keys.length) {
        const pipeline = this.client.pipeline();
        keys.forEach((key) => {
          pipeline.del(key);
        });
        await pipeline.exec();
      }
    });

    return new Promise((resolve, reject) => {
      stream.on("end", () => resolve());
      stream.on("error", (e: any) => reject(e));
    });
  }
}

export default new RedisService();
