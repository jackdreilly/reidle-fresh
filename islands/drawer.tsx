import { useState } from "preact/hooks";
import ReadNotification from "@/islands/ReadNotification.tsx";

export default function Drawer() {
  const [show, setShow] = useState(true);
  return (
    <div>
      <ReadNotification />
      {show}
    </div>
  );
}
