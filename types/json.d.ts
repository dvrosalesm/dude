type JsonPrimitive = string | number | boolean | null;

type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

type StringKeyRecord<Value = JsonValue> = Record<string, Value>;
