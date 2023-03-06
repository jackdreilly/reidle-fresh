import { Handlers, PageProps } from "$fresh/server.ts";
import { Submission } from "../db.ts";




export const handler: Handlers = {
    async GET(req, ctx) {
        const name = (new URL(req.url).searchParams.get('name')) ?? "";
        if (name.length) {
            await Submission.create({ name })
        }
        const submissions = await Submission.all();
        return ctx.render({ submissions });
    }
};

interface Data {
    submissions: Submission[],
}

export default function Page({ data: { submissions } }: PageProps<Data>) {
    return (<div>
        <ol>
            {submissions.map(s => <li key={s.id}>{s.name}</li>)}
        </ol>
        <form>
            <input type="text" placeholder="Your name" name="name" />
            <button type="submit">Set Name</button>
        </form>
    </div>
    );
}