import { useState } from "preact/hooks";
import NavDrawerIcon from "@/components/NavDrawerIcon.tsx";
import { reidleHeaderLinks } from "../components/reidle_template.tsx";

export default function Drawer() {
  const [show, setShow] = useState(false);
  return (
    <button class="p-3 mr-2" onClick={() => setShow((s) => !s)}>
      <NavDrawerIcon />
      <nav
        class={"bg-[#3b0057] p-5 absolute top-[45px] shadow-2xl rounded-md right-0 " +
          (show ? "block" : "hidden")}
      >
        <ul class="text-left text-lg">
          {reidleHeaderLinks.map(({ text, link }) => (
            <li>
              <a class="text-white hover:underline m-3 p-3" href={link}>{text}</a>
            </li>
          ))}
        </ul>
      </nav>
    </button>
  );
}
