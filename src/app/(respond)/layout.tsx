/*
  Egen rute-gren for respondentens interview-flow (/respond/*), adskilt fra
  kundefladens (customer)/layout.tsx — se kommentaren i app/layout.tsx om
  hvorfor chrome-valget IKKE må styres af om der tilfældigvis ligger en
  kunde-session-cookie i browseren. En respondent er ikke en indlogget
  kunde-bruger (deres session er RespondentLoginToken, ikke User), og skal
  aldrig se Nav/Topbar — heller ikke hvis en konsulent tester dette i samme
  browser som sin egen kunde-session. Derfor: helt dumt layout, ingen
  session-opslag, ingen betingelser.
*/
export default function RespondLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex-1 overflow-y-auto">{children}</main>;
}
