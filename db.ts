import { DB } from "https://deno.land/x/sqlite@v3.7.0/mod.ts";
export const db = new DB("test.db");
db.execute(`
DROP TABLE IF EXISTS submissions; 
DROP TABLE IF EXISTS messages; 
`);
db.execute(`
CREATE TABLE submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TIMESTAMP,
  name TEXT,
  time REAL,
  penalty REAL,
  paste TEXT
);
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TIMESTAMP,
  name TEXT,
  message TEXT
);
`);

interface BaseModel {
  id: number,
  date: string,
  name: string,
}

export interface Submission extends BaseModel {
  time: number,
  penalty: number,
  paste: string,
}
export interface Message extends BaseModel {
  message: string,
}