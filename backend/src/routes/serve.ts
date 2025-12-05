import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import mime from "mime";
import { env } from "../config/env.js";
import { DATA_FOLDER } from "../lib/storage/constants.js";
import { storage } from "../lib/storage/index.js";
import { withError } from "../lib/withError.js";
import { type AuthRequest, authenticate } from "./auth.js";

export async function registerServeRoutes(fastify: FastifyInstance) {
	fastify.get("/api/serve/*", async (request, reply) => {
		try {
			const filePath = (request.params as { "*": string })["*"] || "";
			const targetPath = decodeURI(filePath);

			const authRequired = !!env.API_TOKEN;

			if (authRequired) {
				const authResult = await authenticate(request as AuthRequest, reply);
				if (authResult) return authResult;
			}

			const contentType = mime.getType(targetPath.split("/").pop() || "");

			if (!contentType && !targetPath.includes(".")) {
				return reply.code(404).send({ error: "Not Found" });
			}

			const { result: content, error } = await withError(
				storage.readFile(targetPath, contentType || null),
			);

			if (error || !content) {
				return reply.code(404).send({
					error: `Could not read file: ${error?.message || "File not found"}`,
				});
			}

			const headers: Record<string, string> = {
				"Content-Type": contentType ?? "application/octet-stream",
			};

			if ((request as AuthRequest).user?.apiToken) {
				headers["X-API-Token"] = (request as AuthRequest).user!.apiToken;
			}

			return reply.code(200).headers(headers).send(content);
		} catch (error) {
			fastify.log.error({ error }, "File serving error");
			return reply.code(500).send({ error: "Internal server error" });
		}
	});

	fastify.get("/api/static/*", async (request, reply) => {
		try {
			const filePath = (request.params as { "*": string })["*"] || "";
			const targetPath = decodeURI(filePath);

			const contentType = mime.getType(targetPath.split("/").pop() || "");

			if (!contentType && !targetPath.includes(".")) {
				return reply.code(404).send({ error: "Not Found" });
			}

			const imageDataPath = join(DATA_FOLDER, targetPath);
			const imagePublicPath = join(process.cwd(), "public", targetPath);

			const { error: dataAccessError } = await withError(access(imageDataPath));
			const imagePath = dataAccessError ? imagePublicPath : imageDataPath;

			const imageBuffer = await readFile(imagePath);

			return reply
				.code(200)
				.header("Content-Type", contentType || "image/*")
				.send(imageBuffer);
		} catch (error) {
			fastify.log.error({ error }, "Static file serving error");
			return reply.code(404).send({ error: "File not found" });
		}
	});
}
