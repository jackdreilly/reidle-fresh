import { hasAuthSession } from "./lib/session";

let signed = false;
export const signedIn = () => signed;
export const setSignedIn = (v: boolean) => { signed = v; };
export const detectSignedIn = async () => (signed = await hasAuthSession());
