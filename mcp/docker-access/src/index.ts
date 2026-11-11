#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const server = new McpServer({
  name: "mcp-docker",
  version: "1.0.0",
});

server.tool(
  "list_containers",
  "List Docker containers. By default shows only running containers.",
  {
    all: z.boolean().optional().describe("Show all containers (including stopped). Default: false"),
    format: z.enum(["table", "json"]).optional().describe("Output format. Default: json"),
  },
  async ({ all, format }) => {
    const args = ["ps"];
    if (all) args.push("--all");
    args.push("--format", "{{json .}}");

    try {
      const { stdout } = await execFileAsync("docker", args);
      const lines = stdout.trim().split("\n").filter(Boolean);
      const containers = lines.map((line) => JSON.parse(line));

      if (format === "table") {
        const header = "ID | NAME | IMAGE | STATUS | PORTS";
        const rows = containers.map(
          (c: Record<string, string>) =>
            `${c.ID?.slice(0, 12)} | ${c.Names} | ${c.Image} | ${c.Status} | ${c.Ports}`
        );
        return {
          content: [{ type: "text" as const, text: [header, ...rows].join("\n") }],
        };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(containers, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error listing containers: ${message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "inspect_container",
  "Get detailed information about a specific Docker container.",
  {
    container: z.string().describe("Container ID or name"),
  },
  async ({ container }) => {
    try {
      const { stdout } = await execFileAsync("docker", ["inspect", container]);
      return {
        content: [{ type: "text" as const, text: stdout }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error inspecting container: ${message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "container_logs",
  "Get logs from a specific Docker container.",
  {
    container: z.string().describe("Container ID or name"),
    tail: z.number().optional().describe("Number of lines to show from the end. Default: 100"),
  },
  async ({ container, tail }) => {
    const args = ["logs", "--tail", String(tail ?? 100), container];
    try {
      const { stdout, stderr } = await execFileAsync("docker", args);
      const output = stdout || stderr;
      return {
        content: [{ type: "text" as const, text: output }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error getting logs: ${message}` }],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
