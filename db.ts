import {
    Database,
    DataTypes,
    Model,
    SQLite3Connector,
} from "https://deno.land/x/denodb@v1.2.0/mod.ts";

export class Submission extends Model {
    static table = 'submissions';
    static timestamps = true;

    static fields = {
        id: { primaryKey: true, autoIncrement: true },
        name: DataTypes.STRING,
        time: DataTypes.FLOAT,
        penalties: DataTypes.FLOAT,
        events: DataTypes.JSONB,
    };

    static defaults = {
        penalties: 0,
        events: "[]",
    };
}


const db = new Database(new SQLite3Connector({
    filepath: "./db.db"
}));
db.link([Submission]);
await db.sync({ drop: true });