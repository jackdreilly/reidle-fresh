import { useState } from "preact/hooks";

interface Challenger {
  name: string;
  email?: string;
}
export default function Challengers({ players }: { players: Challenger[] }) {
  const [challengers, setChallengers] = useState<Challenger[]>([{
    name: "",
    email: "",
  }]);
  return (
    <div>
      <datalist id="name">
        <option value="test" />
        {players.map(({ name }) => <option value={name} />)}
      </datalist>
      {challengers.map((challenger, i) => (
        <div class="grid gap-6 mb-6 md:grid-cols-2">
          <div>
            <label
              for="name"
              class="block mb-2 text-sm font-medium text-gray-900"
            >
              Name
            </label>
            <input
              id="name"
              autoComplete="0"
              autoCorrect="0"
              list="name"
              class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
              placeholder="Name"
              required
              name="name"
              value={challenger.name}
              onChange={(e) => {
                const newChallengers = [...challengers];
                newChallengers[i].name = e.target.value;
                setChallengers(newChallengers);
              }}
            />
          </div>
          <div>
            <label
              for="email"
              class="block mb-2 text-sm font-medium text-gray-900"
            >
              Email
            </label>
            <input
              type="email"
              required
              contentEditable={!players.map(({ name }) => name).includes(
                challenger.name,
              )}
              class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
              placeholder="Email"
              name="email"
              value={players.filter(({ name }) => name === challenger.name)[0]
                ?.email ?? challenger.email}
              onChange={(e) => {
                const newChallengers = [...challengers];
                newChallengers[i].email = e.target.value;
                setChallengers(newChallengers);
              }}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        class="m-2 border border-black hover:bg-blue-800 hover:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center mr-2"
        onClick={() => {
          setChallengers([...challengers, { name: "", email: "" }]);
        }}
      >
        <svg
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M11 5a3 3 0 11-6 0 3 3 0 016 0zM2.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 018 18a9.953 9.953 0 01-5.385-1.572zM16.25 5.75a.75.75 0 00-1.5 0v2h-2a.75.75 0 000 1.5h2v2a.75.75 0 001.5 0v-2h2a.75.75 0 000-1.5h-2v-2z" />
        </svg>
        Add Challenger
      </button>
    </div>
  );
}
