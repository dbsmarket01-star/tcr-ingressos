import { expect, it, vi } from "vitest";
vi.mock("@/lib/prisma",()=>({prisma:{}}));
import {publicTicketNames} from "@/features/assistant/assistant-public-verification";
it("reads rendered ticket order, ignoring scripts and unrelated headings",()=>{expect(publicTicketNames('<strong>Title</strong><strong class="ticketPickerTitle">OURO &amp; VIP</strong><strong class="ticketPickerTitle">PRATA</strong><script>fake ticketPickerTitle</script>')).toEqual(["OURO & VIP","PRATA"]);});
