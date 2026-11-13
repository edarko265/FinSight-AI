import type { MessageKey } from "@/lib/i18n/messages/en";

/** Swedish messages. Financial vocabulary should be reviewed by a native speaker before release. */
export const sv: Record<MessageKey, string> = {
  "app.name": "FinSight-AI",
  "app.synthetic": "Syntetisk demodata",
  "app.asOf": "Demodatum {date}",
  "nav.dashboard": "Hem",
  "nav.chat": "Coach",
  "nav.insights": "Insikter",
  "nav.settings": "Inställningar",

  "login.title": "Välkommen tillbaka",
  "login.subtitle": "Logga in och prata med dina pengar.",
  "login.customerId": "Kund-ID",
  "login.customerIdHint": "Till exempel CUST03707",
  "login.password": "Lösenord",
  "login.showPassword": "Visa lösenord",
  "login.hidePassword": "Dölj lösenord",
  "login.submit": "Logga in",
  "login.submitting": "Loggar in…",
  "login.forgot": "Glömt lösenordet?",
  "login.error": "Kund-ID eller lösenord stämmer inte.",
  "login.tooMany": "För många försök. Vänta en minut och försök igen.",
  "login.demoTitle": "Demokunder",
  "login.demoHint": "Det här är en demo med syntetisk data. Välj en kund så fylls formuläret i.",
  "login.persona.steady": "Stabil månad",
  "login.persona.tight": "Knappt före lön",
  "login.persona.young": "Ung vuxen",
  "login.persona.senior": "Pensionär",
  "login.notBank": "Ingen riktig bankinloggning. Inga riktiga konton är anslutna.",
  "forgot.title": "Återställ lösenordet",
  "forgot.subtitle": "Ange ditt kund-ID så skickar vi instruktioner.",
  "forgot.submit": "Skicka instruktioner",
  "forgot.sent":
    "Om kunden finns har instruktioner skickats. I den här demon delar alla kunder demolösenordet som visas på inloggningssidan.",
  "forgot.back": "Tillbaka till inloggning",

  "settings.title": "Inställningar",
  "settings.language": "Språk",
  "settings.theme": "Tema",
  "settings.theme.light": "Ljust",
  "settings.theme.dark": "Mörkt",
  "settings.theme.system": "System",
  "settings.fontSize": "Textstorlek",
  "settings.fontSize.small": "Liten",
  "settings.fontSize.medium": "Normal",
  "settings.fontSize.large": "Stor",
  "settings.fontSize.xlarge": "Extra stor",
  "settings.voice": "Röstsvar",
  "settings.voiceHint": "Coachen läser upp svaren.",
  "settings.account": "Konto",
  "settings.signedInAs": "Inloggad som {id}",
  "settings.signOut": "Logga ut",
  "settings.privacy": "Dina uppgifter",
  "settings.privacyBody":
    "Dina transaktioner lagras krypterade med en nyckel som bara hör till ditt konto. AI-modellen får summor och korta sammanfattningar, aldrig din transaktionslista.",

  "chat.intro":
    "Hej! Fråga om dina utgifter, vad som är tryggt att använda eller vad en förändring skulle ge. Jag visar siffrorna bakom varje svar.",
  "chat.placeholder": "Fråga om dina pengar",
  "chat.send": "Skicka",
  "chat.thinking": "Tänker…",
  "chat.error": "Något gick fel hos mig. Försök igen.",
  "chat.addToDashboard": "Lägg till på översikten",
  "chat.added": "Tillagd",
  "chat.seeTransactions": "Visa transaktioner",
  "chat.why": "Varför det här svaret?",
  "chat.modeAi": "AI-coach",
  "chat.modeBasic": "Grundläge (utan AI)",
  "chat.listen": "Lyssna",
  "chat.stop": "Stoppa",
  "chat.speak": "Tala",
  "chat.listening": "Lyssnar…",
  "chat.voiceCall": "Röstsamtal",
  "chat.endCall": "Avsluta samtal",
  "chat.micDenied": "Mikrofonåtkomst behövs för röst.",
  "chat.suggest.where": "Vart tar mina pengar vägen?",
  "chat.suggest.taxi": "Hur mycket lade jag på taxi förra månaden?",
  "chat.suggest.safe": "Vad är tryggt att använda den här veckan?",
  "chat.suggest.whatif": "Tänk om jag drar ner restauranger med 20 %?",
  "chat.suggest.spender": "Vilken sorts konsument är jag?",
  "chat.suggest.peers": "Hur ligger jag till jämfört med jämnåriga?",
  "chat.suggest.bills": "Vilka räkningar är på väg?",

  "dashboard.balance": "Bokfört saldo",
  "dashboard.title": "Min översikt",
  "dashboard.newWidget": "Ny widget",
  "dashboard.empty": "Din översikt är tom. Lägg till en widget och beskriv vad du vill se.",
  "dashboard.remove": "Ta bort",
  "dashboard.safeToSpend": "Tryggt att använda, kommande 7 dagar",
  "dashboard.shortfall": "Beräknat underskott, kommande 7 dagar",
  "dashboard.estimate": "Uppskattning",
  "dashboard.widgetPrompt": "Beskriv vad du vill se",
  "dashboard.widgetExample": "Till exempel: restaurangutgifter under sex månader",
  "dashboard.create": "Skapa widget",
  "dashboard.cancel": "Avbryt",
  "dashboard.noChart":
    "Jag kunde inte göra ett diagram av det. Prova att nämna en kategori eller en tidsperiod.",

  "chart.showValues": "Visa värden",
  "evidence.title": "Transaktionerna bakom svaret",
  "evidence.count": "{count} transaktioner",
  "evidence.empty": "Inga matchande transaktioner i den här datan och perioden.",
  "evidence.close": "Stäng",
  "evidence.more": "Visa fler",
  "evidence.basket": "Korg",

  "insights.title": "Insikter",
  "insights.empty": "Inget kräver din uppmärksamhet just nu.",
  "insights.markRead": "Markera alla som lästa",
  "insights.ask": "Fråga coachen",
  "insight.shortfall.title": "Ett underskott är möjligt den här veckan",
  "insight.shortfall.body":
    "Efter räkningar och nödvändiga utgifter saknas uppskattningsvis {shortfall} under de kommande {days} dagarna.",
  "insight.bill.title": "{category} förfaller snart",
  "insight.bill.body": "Ungefär {amount} brukar betalas runt {date}.",
  "insight.spike.title": "{category} var högre än vanligt",
  "insight.spike.body":
    "{amount} förra månaden, {percent} % över ditt tremånaderssnitt på {average}.",
  "insight.drop.title": "{category} minskade",
  "insight.drop.body":
    "{amount} förra månaden, {percent} % under ditt tremånaderssnitt på {average}.",
  "insight.buffer.title": "Din buffert är mindre än en månads räkningar",
  "insight.buffer.body":
    "Regelbundna räkningar är ungefär {bills} i månaden och det bokförda saldot är {balance}.",
  "insight.reserve.title": "Planera för oregelbundna kostnader",
  "insight.reserve.body":
    "Oregelbundna nödvändiga utgifter som hälsa och reparationer har i snitt varit {amount} i månaden. Att lägga undan det jämnar ut överraskningarna.",
  "insight.slips.title": "Små köp blir mycket",
  "insight.slips.body": "{count} köp under {limit} blev {amount} förra månaden.",
  "insight.peers.title": "{category}: över jämnåriga",
  "insight.peers.body":
    "Du ligger på {amount} i månaden; det typiska intervallet för åldrarna {band} är {low}–{high}.",

  "cat.Housing": "Boende",
  "cat.Utilities": "El, vatten och abonnemang",
  "cat.Health": "Hälsa",
  "cat.Home & Tech": "Hem och teknik",
  "cat.Groceries": "Livsmedel",
  "cat.Transportation": "Transport",
  "cat.Restaurants": "Restauranger",
  "cat.Entertainment": "Nöje",
  "cat.Lifestyle": "Fritid och shopping",
  "cat.Travel": "Resor",
  "cat.taxi": "Taxi",
  "cat.cafes": "Kaféer och snabbmat",
  "cat.other": "Övrigt",

  "basket.regular": "Regelbundna räkningar",
  "basket.irregular": "Oregelbundet nödvändigt",
  "basket.everyday": "Vardagsutgifter",
  "basket.unclassified": "Inte sorterat än",
  "basket.regular.lesson":
    "Obligatoriskt och regelbundet: kostnader som hyran, som kommer varje månad. Planera kring dem först.",
  "basket.irregular.lesson":
    "Obligatoriskt men oregelbundet: en tandläkare eller en trasig tvättmaskin. De går inte att schemalägga, men du kan lägga undan för dem.",
  "basket.everyday.lesson":
    "Vardagsutgifter: den del som rinner mellan fingrarna, och den del du faktiskt kan styra.",
  "necessity.essential": "Nödvändigt",
  "necessity.discretionary": "Ditt val",
  "necessity.unknown": "Beror på dig",

  "period.month": "{month}",
  "period.range": "{from} – {to}",
  "period.monthToDate": "{month} hittills",

  "coach.basis": "Baserat på bokförda syntetiska transaktioner, {period}. Demodatum {asOf}.",
  "coach.none": "Inga matchande transaktioner i den här datan för {period}.",
  "coach.spending.title": "Vart dina pengar tog vägen",
  "coach.spending.summary":
    "Du lade {total} på {count} köp och betalningar under {period}. Den största delen var {top}.",
  "coach.category.title": "{category}",
  "coach.category.summary":
    "Du lade {total} på {category} under {period}, fördelat på {count} transaktioner.",
  "coach.trend.title": "Utgifter per månad",
  "coach.trend.summary":
    "Dina utgifter de senaste {months} månaderna. Den senaste hela månaden var {latest}.",
  "coach.categoryTrend.title": "{category} per månad",
  "coach.categoryTrend.summary":
    "{category} de senaste {months} månaderna. Den senaste hela månaden var {latest}.",
  "coach.balance.title": "Saldo över tid",
  "coach.balance.summary": "Ditt bokförda saldo i slutet av varje månad. Nu är det {balance}.",
  "coach.baskets.title": "Dina tre korgar",
  "coach.baskets.summary":
    "Under {period}: {regular} gick till regelbundna räkningar, {irregular} till oregelbundet nödvändigt och {everyday} till vardagsutgifter. Av vardagsdelen var {choice} ditt eget val.",
  "coach.safe.title": "Tryggt att använda",
  "coach.safe.ok":
    "Ungefär {available} är fritt att använda de kommande {days} dagarna. Det är ditt saldo på {balance} efter att räkningar, vardagens nödvändigheter och en reserv har lagts undan.",
  "coach.safe.shortfall":
    "Uppskattningen visar ett underskott på {shortfall} de kommande {days} dagarna när räkningar och nödvändigheter är undanlagda. Inget är säkert, men det är klokt att hålla igen.",
  "coach.safe.insufficient":
    "Det finns ännu inte tillräckligt med historik för en trygg uppskattning.",
  "coach.safe.basis":
    "En uppskattning, ingen garanti. Väntad inkomst räknas inte förrän den kommit. Väntande betalningar, kontanter och andra konton syns inte här.",
  "coach.safe.row.balance": "Bokfört saldo",
  "coach.safe.row.bills": "Räkningar som förfaller",
  "coach.safe.row.essentials": "Vardagens nödvändigheter",
  "coach.safe.row.reserve": "Reserv för oväntat",
  "coach.safe.row.protected": "Skyddad buffert",
  "coach.safe.row.available": "Fritt att använda",
  "coach.whatif.title": "Tänk om: {category} −{percent} %",
  "coach.whatif.summary":
    "Att dra ner {category} med {percent} % hade sparat {saving} under {period}. Upprepat i ett år blir det ungefär {annual}. Det här är ett tankeexperiment, inget löfte.",
  "coach.whatif.row.now": "Som det var",
  "coach.whatif.row.after": "Med minskningen",
  "coach.whatif.row.saving": "Sparat",
  "coach.peers.title": "Du och dina jämnåriga",
  "coach.peers.summary.lower":
    "Din nivå för {metric} är i snitt {value} i månaden, under det typiska intervallet för åldrarna {band} ({low}–{high}).",
  "coach.peers.summary.typical":
    "Din nivå för {metric} är i snitt {value} i månaden, inom det typiska intervallet för åldrarna {band} ({low}–{high}).",
  "coach.peers.summary.higher":
    "Din nivå för {metric} är i snitt {value} i månaden, över det typiska intervallet för åldrarna {band} ({low}–{high}).",
  "coach.peers.basis":
    "Jämfört med {count} kunder i åldrarna {band} i samma syntetiska datamängd, månadssnitt över tolv månader. Intervallet är gruppens mellersta hälft.",
  "coach.peers.row.you": "Du",
  "coach.peers.row.low": "Nedre kvartilen",
  "coach.peers.row.mid": "Mitten",
  "coach.peers.row.high": "Övre kvartilen",
  "coach.peers.metric.consumption": "totala utgifter",
  "coach.profile.title": "Ditt utgiftsmönster",
  "coach.profile.summary":
    "Regelbundna räkningar tar {regularShare} % av dina utgifter, oregelbundet nödvändigt {irregularShare} % och vardagsutgifter {everydayShare} %. Dina största egna val är {top}.",
  "coach.recurring.title": "Regelbundna betalningar",
  "coach.recurring.summary":
    "Enligt din historik kommer de här varje månad: {list}. Tillsammans ungefär {total} i månaden.",
  "coach.recurring.income":
    "Inkomsten brukar komma runt den {days} i månaden, ungefär {amount} per gång.",
  "coach.recurring.basis":
    "Förslag från de senaste sex hela månaderna. Datan saknar mottagarnamn, så betalningarna är grupperade efter typ.",
  "coach.flow.title": "Vart din inkomst tog vägen",
  "coach.flow.income": "Pengar in",
  "coach.flow.invested": "Investerat",
  "coach.flow.transferred": "Överfört ut",
  "coach.flow.left": "Kvar",
  "coach.flow.summary":
    "Under {period} kom {income} in och {spent} gick till utgifter. {left} blev kvar efter utgifter, investeringar och överföringar.",
  "coach.flow.summaryOver":
    "Under {period} kom {income} in och {spent} gick till utgifter. Utgifter, investeringar och överföringar var {left} mer än det som kom in.",
  "chat.suggest.flow": "Visa hur min inkomst fördelas",
  "views.preset.overview": "Översikt",
  "views.preset.baskets": "Tre korgar",
  "views.preset.everyday": "Vardagsutgifter",
  "views.label": "Vyer",
  "views.period": "Period",
  "views.period.last_month": "Förra månaden",
  "views.period.this_month": "Den här månaden",
  "views.period.last_3_months": "3 mån",
  "views.period.last_6_months": "6 mån",
  "views.period.last_12_months": "12 mån",
  "views.saveAs": "Spara som ny vy",
  "views.namePlaceholder": "Namnge vyn",
  "views.save": "Spara",
  "views.delete": "Ta bort den här vyn",
  "views.unnamed": "Min vy",
  "consent.title": "Innan du använder AI-coachen",
  "consent.intro":
    "AI-coachen använder en extern AI-tjänst för att förstå dina frågor och formulera svaren. Läs hur dina uppgifter används.",
  "consent.point.sent":
    "Vad som skickas: din fråga samt summor och korta sammanfattningar som räknats fram ur dina transaktioner.",
  "consent.point.notSent":
    "Vad som aldrig skickas: din transaktionslista, ditt kund-ID, kontonummer, din ålder eller ditt postnummer.",
  "consent.point.voice":
    "Röst: om du använder den behandlas din talade fråga och coachens svar av en taltjänst.",
  "consent.point.advice":
    "Coachen förklarar och uppskattar. Det är inte finansiell rådgivning och uppskattningarna är inga garantier.",
  "consent.point.choice":
    "Valet är ditt. Utan AI svarar coachen ändå på vanliga frågor med beräkningar som görs här, och du kan ändra dig i Inställningar när som helst.",
  "consent.readMore": "Läs hela integritetsmeddelandet",
  "consent.accept": "Jag godkänner, använd AI-coachen",
  "consent.decline": "Fortsätt utan AI",
  "settings.ai": "AI-coach",
  "settings.aiOn": "Du har godkänt AI-behandling. Stäng av för att återkalla ditt samtycke.",
  "settings.aiOff":
    "AI är avstängt. Coachen svarar i grundläge och inget skickas till en AI-tjänst.",
  "settings.download": "Ladda ner mina uppgifter",
  "settings.erase": "Radera mina appuppgifter",
  "settings.eraseConfirm":
    "Radera dina sparade vyer, lästa insikter och ditt samtycke, och logga ut? Det går inte att ångra.",
  "settings.eraseYes": "Ja, radera",
  "settings.privacyLink": "Integritetsmeddelande",
  "privacy.title": "Integritetsmeddelande",
  "privacy.demo":
    "FinSight-AI är en prototyp som körs på syntetisk data från ett hackathon. Inga riktiga kunduppgifter behandlas. Det här meddelandet beskriver hur tjänsten är utformad för att hantera personuppgifter.",
  "privacy.what.title": "Vad vi behandlar",
  "privacy.what.body":
    "Dina kontotransaktioner, en grundprofil (ålder och postnummer), de vyer du sparar, vilka insikter du har läst och dina samtyckesval.",
  "privacy.why.title": "Varför och på vilken grund",
  "privacy.why.body":
    "För att visa och förklara din egen ekonomi för dig. Beräkningarna görs i den här tjänsten. Något skickas till en AI- eller taltjänst endast med ditt samtycke, som du kan återkalla när som helst.",
  "privacy.ai.title": "AI- och taltjänster",
  "privacy.ai.body":
    "Med ditt samtycke skickas din fråga samt summor och korta sammanfattningar till en språkmodellstjänst (OpenAI eller Google), och röst till ElevenLabs. Din transaktionslista och dina identifierare skickas aldrig. Inga beslut med rättslig verkan fattas automatiskt.",
  "privacy.security.title": "Hur uppgifterna skyddas",
  "privacy.security.body":
    "Dina uppgifter krypteras innan de lagras, med en nyckel som bara hör till ditt konto, och tjänsten är utformad för att driftas inom EU. Anslutningarna är krypterade. Personal med databasåtkomst kan inte läsa dem.",
  "privacy.rights.title": "Dina rättigheter",
  "privacy.rights.body":
    "Du kan se och ladda ner dina uppgifter, återkalla samtycke och radera det appen har lagrat om dig, allt från Inställningar. Du kan också klaga hos dataskyddsmyndigheten.",
  "privacy.retention.title": "Hur länge",
  "privacy.retention.body":
    "Inloggningssessioner avslutas efter åtta timmar. Samtal sparas inte. Sparade vyer och samtycke finns kvar tills du raderar dem.",
  "privacy.back": "Tillbaka",
  "coach.fallback":
    "Jag kan visa vart dina pengar tar vägen, vad som är tryggt att använda, vad en minskning skulle spara, dina regelbundna betalningar eller hur du ligger till jämfört med jämnåriga.",
  "coach.statfin.title": "Du och hushållen i Finland",
  "coach.statfin.summary":
    "I Finland lade hushåll i åldersgruppen {band} ungefär {average} i månaden per vuxen på {category} ({year}). Ditt snitt är {value}.",
  "coach.statfin.basis":
    "Statistikcentralen, konsumtionsundersökningen {year}, per konsumtionsenhet. Ett konto är inte ett helt hushåll och kategorierna skiljer sig något, så läs detta som sammanhang, inte som en rangordning.",
};
