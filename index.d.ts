import { NodeAPI, Node, NodeDef } from "node-red";

export interface PgvectorConfigDef extends NodeDef {
  host: string;
  port: number;
  database: string;
  ssl?: boolean;
  max?: number;
}

export interface PgvectorConfigNode extends Node {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  pool: unknown;
}

export default function (RED: NodeAPI): void;
