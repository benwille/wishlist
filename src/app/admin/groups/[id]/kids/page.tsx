import {redirect} from "next/navigation";
export default async function LegacyKids({params}:{params:Promise<{id:string}>}){redirect(`/admin/groups/${(await params).id}#kids`);}
