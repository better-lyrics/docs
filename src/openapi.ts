import { API_BASE } from './api';

export const SPEC_URL = `${API_BASE}/openapi.json`;

type Ref = { $ref: string };

export interface Schema {
  type?: string;
  enum?: string[];
  description?: string;
  required?: string[];
  properties?: Record<string, Schema | Ref>;
  items?: Schema | Ref;
  pattern?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
}

interface Parameter {
  name: string;
  in: string;
  description?: string;
  required?: boolean;
  schema?: Schema | Ref;
}

interface Header {
  description?: string;
  required?: boolean;
  schema?: Schema | Ref;
}

interface Response {
  description: string;
  headers?: Record<string, Header | Ref>;
  content?: Record<string, { schema?: Schema | Ref }>;
}

interface Operation {
  summary?: string;
  deprecated?: boolean;
  description?: string;
  parameters?: (Parameter | Ref)[];
  responses: Record<string, Response | Ref>;
}

interface Spec {
  paths: Record<string, Record<string, Operation>>;
  components: Record<string, Record<string, unknown>>;
}

let specPromise: Promise<Spec> | undefined;

export function getSpec(): Promise<Spec> {
  specPromise ??= fetch(SPEC_URL).then((res) => {
    if (!res.ok) throw new Error(`OpenAPI spec: ${SPEC_URL} returned ${res.status}`);
    return res.json() as Promise<Spec>;
  });
  return specPromise;
}

function isRef(value: unknown): value is Ref {
  return typeof value === 'object' && value !== null && '$ref' in value;
}

function resolve<T>(spec: Spec, value: T | Ref): T {
  if (!isRef(value)) return value;
  const [, , section, name] = value.$ref.split('/');
  const target = spec.components[section]?.[name];
  if (!target) throw new Error(`OpenAPI spec: unresolved ${value.$ref}`);
  return resolve(spec, target as T | Ref);
}

function resolveSchema(spec: Spec, value: Schema | Ref): Schema {
  if (!isRef(value)) return value;
  const { $ref: _, ...overrides } = value as Ref & Schema;
  return { ...resolve<Schema>(spec, { $ref: value.$ref }), ...overrides };
}

export function getOperation(spec: Spec, path: string, method = 'get'): Operation {
  const operation = spec.paths[path]?.[method];
  if (!operation) throw new Error(`OpenAPI spec: no ${method.toUpperCase()} ${path}`);
  return operation;
}

export function typeLabel(spec: Spec, value: Schema | Ref | undefined): string {
  if (!value) return '';
  const schema = resolveSchema(spec, value);
  if (schema.type === 'array' && schema.items) return `${typeLabel(spec, schema.items)}[]`;
  if (schema.type === 'string' && schema.pattern === '^[0-9]+$') return 'string of digits';
  return schema.type ?? '';
}

function enumNote(schema: Schema): string {
  return schema.enum ? `One of ${schema.enum.map((value) => `\`${value}\``).join(', ')}.` : '';
}

const ALIAS = /^Alias of `([^`]+)`\.$/;

export interface ParameterRow {
  names: string[];
  type: string;
  required: boolean;
  description: string;
}

export function parameterRows(spec: Spec, path: string): ParameterRow[] {
  const parameters = (getOperation(spec, path).parameters ?? []).map((p) => resolve<Parameter>(spec, p));
  const rows = new Map<string, ParameterRow>();
  for (const parameter of parameters) {
    const alias = ALIAS.exec(parameter.description ?? '')?.[1];
    const row = alias ? rows.get(alias) : undefined;
    if (row) {
      row.names.push(parameter.name);
      continue;
    }
    const schema = parameter.schema ? resolveSchema(spec, parameter.schema) : {};
    rows.set(parameter.name, {
      names: [parameter.name],
      type: typeLabel(spec, parameter.schema),
      required: parameter.required ?? false,
      description: [parameter.description, enumNote(schema)].filter(Boolean).join(' '),
    });
  }
  return [...rows.values()];
}

export interface HeaderRow {
  name: string;
  description: string;
}

export function responseHeaderRows(spec: Spec, path: string): HeaderRow[] {
  const rows = new Map<string, HeaderRow>();
  for (const response of Object.values(getOperation(spec, path).responses)) {
    for (const [name, header] of Object.entries(resolve<Response>(spec, response).headers ?? {})) {
      if (rows.has(name)) continue;
      rows.set(name, { name, description: resolve<Header>(spec, header).description?.trim() ?? '' });
    }
  }
  return [...rows.values()];
}

export interface FieldRow {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

function collectFields(spec: Spec, schema: Schema, prefix: string, rows: FieldRow[]) {
  for (const [name, value] of Object.entries(schema.properties ?? {})) {
    const field = resolveSchema(spec, value);
    rows.push({
      name: `${prefix}${name}`,
      type: typeLabel(spec, value),
      required: schema.required?.includes(name) ?? false,
      description: [field.description?.trim(), enumNote(field)].filter(Boolean).join(' '),
    });
    if (field.type === 'object') collectFields(spec, field, `${prefix}${name}.`, rows);
    if (field.type === 'array' && field.items) collectFields(spec, resolveSchema(spec, field.items), `${prefix}${name}[].`, rows);
  }
}

export function fieldRows(spec: Spec, path: string, status = '200'): FieldRow[] {
  const response = getOperation(spec, path).responses[status];
  if (!response) throw new Error(`OpenAPI spec: no ${status} response for ${path}`);
  const schema = resolve<Response>(spec, response).content?.['application/json']?.schema;
  if (!schema) throw new Error(`OpenAPI spec: ${status} response for ${path} has no JSON schema`);
  const rows: FieldRow[] = [];
  collectFields(spec, resolveSchema(spec, schema), '', rows);
  return rows;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function inlineMarkdown(text: string): string {
  return escapeHtml(text.replace(/\s+/g, ' ').trim()).replace(/`([^`]+)`/g, '<code>$1</code>');
}

export interface EndpointRow {
  method: string;
  path: string;
  summary: string;
  deprecated: boolean;
}

export function endpointRows(spec: Spec): EndpointRow[] {
  return Object.entries(spec.paths).flatMap(([path, operations]) =>
    Object.entries(operations).map(([method, operation]) => ({
      method: method.toUpperCase(),
      path,
      summary: operation.summary ?? '',
      deprecated: operation.deprecated ?? false,
    })),
  );
}
