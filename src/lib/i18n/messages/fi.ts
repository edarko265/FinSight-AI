import type { MessageKey } from "@/lib/i18n/messages/en";

/** Finnish messages. Financial vocabulary should be reviewed by a native speaker before release. */
export const fi: Record<MessageKey, string> = {
  "app.name": "FinSight-AI",
  "app.synthetic": "Synteettinen demodata",
  "app.asOf": "Demon päivämäärä {date}",
  "nav.dashboard": "Koti",
  "nav.chat": "Valmentaja",
  "nav.insights": "Havainnot",
  "nav.settings": "Asetukset",

  "login.title": "Tervetuloa takaisin",
  "login.subtitle": "Kirjaudu sisään ja keskustele rahoistasi.",
  "login.customerId": "Asiakastunnus",
  "login.customerIdHint": "Esimerkiksi CUST03707",
  "login.password": "Salasana",
  "login.showPassword": "Näytä salasana",
  "login.hidePassword": "Piilota salasana",
  "login.submit": "Kirjaudu",
  "login.submitting": "Kirjaudutaan…",
  "login.forgot": "Unohditko salasanan?",
  "login.error": "Asiakastunnus tai salasana on väärin.",
  "login.tooMany": "Liian monta yritystä. Odota hetki ja yritä uudelleen.",
  "login.demoTitle": "Demoasiakkaat",
  "login.demoHint": "Tämä on demo synteettisellä datalla. Valitse asiakas, niin lomake täytetään.",
  "login.persona.steady": "Tasainen kuukausi",
  "login.persona.tight": "Tiukkaa ennen palkkapäivää",
  "login.persona.young": "Nuori aikuinen",
  "login.persona.senior": "Eläkeläinen",
  "login.notBank": "Ei oikea pankkikirjautuminen. Oikeita tilejä ei ole yhdistetty.",
  "forgot.title": "Vaihda salasana",
  "forgot.subtitle": "Anna asiakastunnuksesi, niin lähetämme ohjeet.",
  "forgot.submit": "Lähetä ohjeet",
  "forgot.sent":
    "Jos asiakas löytyy, ohjeet on lähetetty. Tässä demossa kaikilla asiakkailla on sama, kirjautumissivulla näkyvä demosalasana.",
  "forgot.back": "Takaisin kirjautumiseen",

  "settings.title": "Asetukset",
  "settings.language": "Kieli",
  "settings.theme": "Teema",
  "settings.theme.light": "Vaalea",
  "settings.theme.dark": "Tumma",
  "settings.theme.system": "Järjestelmä",
  "settings.fontSize": "Tekstin koko",
  "settings.fontSize.small": "Pieni",
  "settings.fontSize.medium": "Normaali",
  "settings.fontSize.large": "Suuri",
  "settings.fontSize.xlarge": "Erittäin suuri",
  "settings.voice": "Puhevastaukset",
  "settings.voiceHint": "Valmentaja lukee vastaukset ääneen.",
  "settings.account": "Tili",
  "settings.signedInAs": "Kirjautuneena: {id}",
  "settings.signOut": "Kirjaudu ulos",
  "settings.privacy": "Sinun tietosi",
  "settings.privacyBody":
    "Tapahtumasi tallennetaan salattuina avaimella, joka kuuluu vain sinun tilillesi. Tekoälymalli saa summia ja lyhyitä yhteenvetoja, ei koskaan tapahtumaluetteloasi.",

  "chat.intro":
    "Hei! Kysy kulutuksestasi, siitä mitä on turvallista käyttää tai mitä jokin muutos toisi. Näytän luvut jokaisen vastauksen takana.",
  "chat.placeholder": "Kysy rahoistasi",
  "chat.send": "Lähetä",
  "chat.thinking": "Mietin…",
  "chat.error": "Jokin meni vikaan. Yritä uudelleen.",
  "chat.addToDashboard": "Lisää koontinäyttöön",
  "chat.added": "Lisätty",
  "chat.seeTransactions": "Näytä tapahtumat",
  "chat.why": "Miksi tämä vastaus?",
  "chat.modeAi": "Tekoälyvalmentaja",
  "chat.modeBasic": "Perustila (ilman tekoälyä)",
  "chat.listen": "Kuuntele",
  "chat.stop": "Pysäytä",
  "chat.speak": "Puhu",
  "chat.listening": "Kuuntelen…",
  "chat.voiceCall": "Äänipuhelu",
  "chat.endCall": "Lopeta puhelu",
  "chat.micDenied": "Ääntä varten tarvitaan mikrofonin käyttöoikeus.",
  "chat.suggest.where": "Mihin rahani menevät?",
  "chat.suggest.taxi": "Paljonko käytin takseihin viime kuussa?",
  "chat.suggest.safe": "Paljonko voin käyttää tällä viikolla?",
  "chat.suggest.whatif": "Entä jos vähennän ravintoloita 20 %?",
  "chat.suggest.spender": "Millainen kuluttaja olen?",
  "chat.suggest.peers": "Miten vertaudun ikäisiini?",
  "chat.suggest.bills": "Mitä laskuja on tulossa?",

  "dashboard.balance": "Kirjattu saldo",
  "dashboard.title": "Oma koontinäyttö",
  "dashboard.newWidget": "Uusi näkymä",
  "dashboard.empty": "Koontinäyttösi on tyhjä. Lisää näkymä ja kerro, mitä haluat nähdä.",
  "dashboard.remove": "Poista",
  "dashboard.safeToSpend": "Käytettävissä, seuraavat 7 päivää",
  "dashboard.shortfall": "Arvioitu vaje, seuraavat 7 päivää",
  "dashboard.estimate": "Arvio",
  "dashboard.widgetPrompt": "Kerro, mitä haluat nähdä",
  "dashboard.widgetExample": "Esimerkiksi: ravintolakulut kuuden kuukauden ajalta",
  "dashboard.create": "Luo näkymä",
  "dashboard.cancel": "Peruuta",
  "dashboard.noChart": "En saanut tästä kaaviota. Kokeile nimetä luokka tai ajanjakso.",

  "chart.showValues": "Näytä luvut",
  "evidence.title": "Vastauksen taustalla olevat tapahtumat",
  "evidence.count": "{count} tapahtumaa",
  "evidence.empty": "Ei vastaavia tapahtumia tässä datassa ja tällä jaksolla.",
  "evidence.close": "Sulje",
  "evidence.more": "Näytä lisää",
  "evidence.basket": "Kori",

  "insights.title": "Havainnot",
  "insights.empty": "Mikään ei vaadi huomiotasi juuri nyt.",
  "insights.markRead": "Merkitse kaikki luetuiksi",
  "insights.ask": "Kysy valmentajalta",
  "insight.shortfall.title": "Tällä viikolla voi tulla vajetta",
  "insight.shortfall.body":
    "Laskujen ja välttämättömien menojen jälkeen arvio jää {shortfall} vajaaksi seuraavien {days} päivän aikana.",
  "insight.bill.title": "{category} erääntyy pian",
  "insight.bill.body": "Noin {amount} maksetaan yleensä {date} tienoilla.",
  "insight.spike.title": "{category} oli tavallista suurempi",
  "insight.spike.body":
    "{amount} viime kuussa, {percent} % yli kolmen kuukauden keskiarvosi {average}.",
  "insight.drop.title": "{category} pieneni",
  "insight.drop.body":
    "{amount} viime kuussa, {percent} % alle kolmen kuukauden keskiarvosi {average}.",
  "insight.buffer.title": "Puskurisi on alle kuukauden laskut",
  "insight.buffer.body":
    "Säännölliset laskut ovat noin {bills} kuussa ja kirjattu saldo on {balance}.",
  "insight.reserve.title": "Varaudu epäsäännöllisiin menoihin",
  "insight.reserve.body":
    "Epäsäännölliset välttämättömät menot, kuten terveys ja korjaukset, ovat olleet keskimäärin {amount} kuussa. Sen varaaminen tasaa yllätykset.",
  "insight.slips.title": "Pienet ostokset kertyvät",
  "insight.slips.body": "{count} alle {limit} ostosta teki yhteensä {amount} viime kuussa.",
  "insight.peers.title": "{category}: enemmän kuin ikäisilläsi",
  "insight.peers.body":
    "Käytät keskimäärin {amount} kuussa; tyypillinen vaihteluväli {band}-vuotiailla on {low}–{high}.",

  "cat.Housing": "Asuminen",
  "cat.Utilities": "Sähkö, vesi ja liittymät",
  "cat.Health": "Terveys",
  "cat.Home & Tech": "Koti ja tekniikka",
  "cat.Groceries": "Ruokakauppa",
  "cat.Transportation": "Liikenne",
  "cat.Restaurants": "Ravintolat",
  "cat.Entertainment": "Viihde",
  "cat.Lifestyle": "Vapaa-aika ja ostokset",
  "cat.Travel": "Matkailu",
  "cat.taxi": "Taksit",
  "cat.cafes": "Kahvilat ja pikaruoka",
  "cat.other": "Muut",

  "basket.regular": "Säännölliset laskut",
  "basket.irregular": "Epäsäännölliset välttämättömät",
  "basket.everyday": "Arjen kulutus",
  "basket.unclassified": "Luokittelematta",
  "basket.regular.lesson":
    "Pakolliset ja säännölliset: menot kuten vuokra, jotka tulevat joka kuukausi. Suunnittele ensin niiden ympärille.",
  "basket.irregular.lesson":
    "Pakolliset mutta epäsäännölliset: hammaslääkäri tai rikkoutunut pesukone. Niitä ei voi ajoittaa, mutta niihin voi varautua.",
  "basket.everyday.lesson":
    "Arjen kulutus: se osa, joka valuu sormien läpi, ja se osa, jota voit oikeasti ohjata.",
  "necessity.essential": "Välttämätön",
  "necessity.discretionary": "Oma valinta",
  "necessity.unknown": "Riippuu sinusta",

  "period.month": "{month}",
  "period.range": "{from} – {to}",
  "period.monthToDate": "{month} tähän mennessä",

  "coach.basis":
    "Perustuu kirjattuihin synteettisiin tapahtumiin, {period}. Demon päivämäärä {asOf}.",
  "coach.none": "Ei vastaavia tapahtumia tässä datassa jaksolla {period}.",
  "coach.spending.title": "Mihin rahasi menivät",
  "coach.spending.summary":
    "Käytit {total} yhteensä {count} ostoon ja maksuun jaksolla {period}. Suurin osa oli {top}.",
  "coach.category.title": "{category}",
  "coach.category.summary":
    "Käytit {total} luokkaan {category} jaksolla {period}, {count} tapahtumaa.",
  "coach.trend.title": "Kulutus kuukausittain",
  "coach.trend.summary":
    "Kulutuksesi viimeisten {months} kuukauden ajalta. Viimeisin täysi kuukausi oli {latest}.",
  "coach.categoryTrend.title": "{category} kuukausittain",
  "coach.categoryTrend.summary":
    "{category} viimeisten {months} kuukauden ajalta. Viimeisin täysi kuukausi oli {latest}.",
  "coach.balance.title": "Saldo ajan mittaan",
  "coach.balance.summary": "Kirjattu saldosi kunkin kuukauden lopussa. Nyt se on {balance}.",
  "coach.baskets.title": "Kolme koriasi",
  "coach.baskets.summary":
    "Jaksolla {period}: {regular} meni säännöllisiin laskuihin, {irregular} epäsäännöllisiin välttämättömiin ja {everyday} arjen kulutukseen. Arjen osasta {choice} oli omaa valintaasi.",
  "coach.safe.title": "Turvallisesti käytettävissä",
  "coach.safe.ok":
    "Noin {available} on vapaasti käytettävissä seuraavien {days} päivän aikana. Se on saldosi {balance}, kun laskut, arjen välttämättömät menot ja varaus on laitettu sivuun.",
  "coach.safe.shortfall":
    "Arvio jää {shortfall} vajaaksi seuraavien {days} päivän aikana, kun laskut ja välttämättömät menot on huomioitu. Mikään ei ole varmaa, mutta kannattaa jarruttaa.",
  "coach.safe.insufficient": "Historiaa ei ole vielä tarpeeksi turvalliseen arvioon.",
  "coach.safe.basis":
    "Arvio, ei takuu. Odotettua tuloa ei lasketa ennen kuin se saapuu. Odottavat maksut, käteinen ja muut tilit eivät näy tässä.",
  "coach.safe.row.balance": "Kirjattu saldo",
  "coach.safe.row.bills": "Erääntyvät laskut",
  "coach.safe.row.essentials": "Arjen välttämättömät",
  "coach.safe.row.reserve": "Varaus yllätyksiin",
  "coach.safe.row.protected": "Suojattu puskuri",
  "coach.safe.row.available": "Vapaasti käytettävissä",
  "coach.whatif.title": "Entä jos: {category} −{percent} %",
  "coach.whatif.summary":
    "Jos {category} olisi ollut {percent} % pienempi, olisit säästänyt {saving} jaksolla {period}. Vuoden ajan toistettuna se on noin {annual}. Tämä on ajatusleikki, ei lupaus.",
  "coach.whatif.row.now": "Toteutunut",
  "coach.whatif.row.after": "Vähennyksen jälkeen",
  "coach.whatif.row.saving": "Säästö",
  "coach.peers.title": "Sinä ja ikäisesi",
  "coach.peers.summary.lower":
    "{metric} on sinulla keskimäärin {value} kuussa, alle {band}-vuotiaiden tyypillisen vaihteluvälin ({low}–{high}).",
  "coach.peers.summary.typical":
    "{metric} on sinulla keskimäärin {value} kuussa, {band}-vuotiaiden tyypillisellä vaihteluvälillä ({low}–{high}).",
  "coach.peers.summary.higher":
    "{metric} on sinulla keskimäärin {value} kuussa, yli {band}-vuotiaiden tyypillisen vaihteluvälin ({low}–{high}).",
  "coach.peers.basis":
    "Vertailussa {count} saman synteettisen aineiston {band}-vuotiasta asiakasta, kahdentoista kuukauden kuukausikeskiarvo. Vaihteluväli on ryhmän keskimmäinen puolikas.",
  "coach.peers.row.you": "Sinä",
  "coach.peers.row.low": "Alin neljännes",
  "coach.peers.row.mid": "Keskikohta",
  "coach.peers.row.high": "Ylin neljännes",
  "coach.peers.metric.consumption": "Kokonaiskulutus",
  "coach.profile.title": "Kulutustapasi",
  "coach.profile.summary":
    "Säännölliset laskut vievät {regularShare} % kulutuksestasi, epäsäännölliset välttämättömät {irregularShare} % ja arjen kulutus {everydayShare} %. Suurimmat omat valintasi ovat {top}.",
  "coach.recurring.title": "Säännölliset maksut",
  "coach.recurring.summary":
    "Historiasi perusteella nämä tulevat joka kuukausi: {list}. Yhteensä noin {total} kuussa.",
  "coach.recurring.income":
    "Tulo saapuu yleensä kuun {days}. päivän tienoilla, noin {amount} kerralla.",
  "coach.recurring.basis":
    "Ehdotuksia kuuden viimeisen täyden kuukauden perusteella. Datassa ei ole maksunsaajien nimiä, joten maksut on ryhmitelty tyypin mukaan.",
  "coach.flow.title": "Mihin tulosi menivät",
  "coach.flow.income": "Rahaa sisään",
  "coach.flow.invested": "Sijoitettu",
  "coach.flow.transferred": "Siirretty pois",
  "coach.flow.left": "Jäljelle jäi",
  "coach.flow.summary":
    "Jaksolla {period} tuloja tuli {income} ja kulutukseen meni {spent}. Kulutuksen, sijoitusten ja siirtojen jälkeen jäi {left}.",
  "coach.flow.summaryOver":
    "Jaksolla {period} tuloja tuli {income} ja kulutukseen meni {spent}. Kulutus, sijoitukset ja siirrot ylittivät tulot {left}.",
  "chat.suggest.flow": "Näytä, miten tuloni jakautuvat",
  "views.preset.overview": "Yleiskuva",
  "views.preset.baskets": "Kolme koria",
  "views.preset.everyday": "Arjen kulutus",
  "views.label": "Näkymät",
  "views.period": "Ajanjakso",
  "views.period.last_month": "Viime kuu",
  "views.period.this_month": "Tämä kuu",
  "views.period.last_3_months": "3 kk",
  "views.period.last_6_months": "6 kk",
  "views.period.last_12_months": "12 kk",
  "views.saveAs": "Tallenna uutena näkymänä",
  "views.namePlaceholder": "Anna näkymälle nimi",
  "views.save": "Tallenna",
  "views.delete": "Poista tämä näkymä",
  "views.unnamed": "Oma näkymä",
  "consent.title": "Ennen kuin käytät tekoälyvalmentajaa",
  "consent.intro":
    "Tekoälyvalmentaja käyttää ulkopuolista tekoälypalvelua kysymystesi ymmärtämiseen ja vastausten muotoiluun. Lue, miten tietojasi käytetään.",
  "consent.point.sent":
    "Mitä lähetetään: kysymyksesi sekä tapahtumistasi lasketut summat ja lyhyet yhteenvedot.",
  "consent.point.notSent":
    "Mitä ei koskaan lähetetä: tapahtumaluettelosi, asiakastunnuksesi, tilinumerosi, ikäsi tai postinumerosi.",
  "consent.point.voice":
    "Ääni: jos käytät sitä, puhuttu kysymyksesi ja valmentajan vastaus käsitellään puhepalvelussa.",
  "consent.point.advice":
    "Valmentaja selittää ja arvioi. Se ei ole sijoitus- tai talousneuvontaa, eivätkä arviot ole takuita.",
  "consent.point.choice":
    "Valinta on sinun. Ilman tekoälyä valmentaja vastaa silti yleisimpiin kysymyksiin täällä tehdyillä laskelmilla, ja voit muuttaa mieltäsi asetuksissa milloin tahansa.",
  "consent.readMore": "Lue koko tietosuojaseloste",
  "consent.accept": "Hyväksyn, käytä tekoälyvalmentajaa",
  "consent.decline": "Jatka ilman tekoälyä",
  "settings.ai": "Tekoälyvalmentaja",
  "settings.aiOn": "Olet hyväksynyt tekoälykäsittelyn. Kytke pois peruuttaaksesi suostumuksesi.",
  "settings.aiOff":
    "Tekoäly on pois päältä. Valmentaja vastaa perustilassa, eikä mitään lähetetä tekoälypalveluun.",
  "settings.download": "Lataa tietoni",
  "settings.erase": "Poista sovellustietoni",
  "settings.eraseConfirm":
    "Poistetaanko tallennetut näkymäsi, luetut havainnot ja suostumus, ja kirjaudutaanko ulos? Tätä ei voi perua.",
  "settings.eraseYes": "Kyllä, poista",
  "settings.privacyLink": "Tietosuojaseloste",
  "privacy.title": "Tietosuojaseloste",
  "privacy.demo":
    "FinSight-AI on prototyyppi, joka käyttää hackathonia varten toimitettua synteettistä dataa. Oikeita asiakastietoja ei käsitellä. Tämä seloste kuvaa, miten palvelu on suunniteltu käsittelemään henkilötietoja.",
  "privacy.what.title": "Mitä käsittelemme",
  "privacy.what.body":
    "Tilitapahtumasi, perustiedot (ikä ja postinumero), tallentamasi näkymät, lukemasi havainnot ja suostumusvalintasi.",
  "privacy.why.title": "Miksi ja millä perusteella",
  "privacy.why.body":
    "Näyttääksemme ja selittääksemme sinulle oman taloutesi. Laskelmat tehdään tässä palvelussa. Mitään ei lähetetä tekoäly- tai puhepalveluun ilman suostumustasi, jonka voit peruuttaa milloin tahansa.",
  "privacy.ai.title": "Tekoäly- ja puhepalvelut",
  "privacy.ai.body":
    "Suostumuksellasi kysymyksesi sekä summat ja lyhyet yhteenvedot lähetetään kielimallipalveluun (OpenAI tai Google) ja ääni ElevenLabsille. Tapahtumaluetteloasi ja tunnisteitasi ei koskaan lähetetä. Oikeusvaikutuksia sisältäviä päätöksiä ei tehdä automaattisesti.",
  "privacy.security.title": "Miten tiedot suojataan",
  "privacy.security.body":
    "Tietosi salataan ennen tallennusta avaimella, joka kuuluu vain sinun tilillesi, ja palvelu on suunniteltu ylläpidettäväksi EU:ssa. Yhteydet on salattu. Tietokantaan pääsevä henkilöstö ei voi lukea niitä.",
  "privacy.rights.title": "Oikeutesi",
  "privacy.rights.body":
    "Voit nähdä ja ladata tietosi, peruuttaa suostumuksesi ja poistaa sovelluksen sinusta tallentamat tiedot asetuksista. Voit myös tehdä valituksen tietosuojaviranomaiselle.",
  "privacy.retention.title": "Kuinka kauan",
  "privacy.retention.body":
    "Kirjautumisistunnot päättyvät kahdeksan tunnin kuluttua. Keskusteluja ei tallenneta. Tallennetut näkymät ja suostumus säilyvät, kunnes poistat ne.",
  "privacy.back": "Takaisin",
  "coach.fallback":
    "Voin näyttää, mihin rahasi menevät, paljonko on turvallista käyttää, mitä vähennys säästäisi, säännölliset maksusi tai miten vertaudut ikäisiisi.",
  "coach.statfin.title": "Sinä ja suomalaiset kotitaloudet",
  "coach.statfin.summary":
    "Suomessa ikäryhmän {band} kotitaloudet käyttivät noin {average} kuussa aikuista kohti luokkaan {category} ({year}). Sinun keskiarvosi on {value}.",
  "coach.statfin.basis":
    "Tilastokeskus, kulutustutkimus {year}, kulutusyksikköä kohti. Yksi tili ei ole koko kotitalous ja luokat eroavat hieman, joten tämä on taustatietoa, ei sijoitus.",
};
