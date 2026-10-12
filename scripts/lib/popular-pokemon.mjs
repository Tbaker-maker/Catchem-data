// Popularity weight for the IR watchlist. Transparent and documented.
// Written 2026-10-12 from Tyler's brief: Gen 1, starters, Eeveelutions,
// Pikachu, Charizard and other widely collected Pokemon rank higher.
// The weight only orders the private watchlist. It is never shown as advice.
// Matching is by the Pokemon name at the start of the card name.

export const GEN1 = "bulbasaur,ivysaur,venusaur,charmander,charmeleon,charizard,squirtle,wartortle,blastoise,caterpie,metapod,butterfree,weedle,kakuna,beedrill,pidgey,pidgeotto,pidgeot,rattata,raticate,spearow,fearow,ekans,arbok,pikachu,raichu,sandshrew,sandslash,nidoran,nidorina,nidoqueen,nidorino,nidoking,clefairy,clefable,vulpix,ninetales,jigglypuff,wigglytuff,zubat,golbat,oddish,gloom,vileplume,paras,parasect,venonat,venomoth,diglett,dugtrio,meowth,persian,psyduck,golduck,mankey,primeape,growlithe,arcanine,poliwag,poliwhirl,poliwrath,abra,kadabra,alakazam,machop,machoke,machamp,bellsprout,weepinbell,victreebel,tentacool,tentacruel,geodude,graveler,golem,ponyta,rapidash,slowpoke,slowbro,magnemite,magneton,farfetch'd,doduo,dodrio,seel,dewgong,grimer,muk,shellder,cloyster,gastly,haunter,gengar,onix,drowzee,hypno,krabby,kingler,voltorb,electrode,exeggcute,exeggutor,cubone,marowak,hitmonlee,hitmonchan,lickitung,koffing,weezing,rhyhorn,rhydon,chansey,tangela,kangaskhan,horsea,seadra,goldeen,seaking,staryu,starmie,mr. mime,scyther,jynx,electabuzz,magmar,pinsir,tauros,magikarp,gyarados,lapras,ditto,eevee,vaporeon,jolteon,flareon,porygon,omanyte,omastar,kabuto,kabutops,aerodactyl,snorlax,articuno,zapdos,moltres,dratini,dragonair,dragonite,mewtwo,mew".split(",");

// Every generation's three starter lines, all stages.
export const STARTERS = "bulbasaur,ivysaur,venusaur,charmander,charmeleon,charizard,squirtle,wartortle,blastoise,chikorita,bayleef,meganium,cyndaquil,quilava,typhlosion,totodile,croconaw,feraligatr,treecko,grovyle,sceptile,torchic,combusken,blaziken,mudkip,marshtomp,swampert,turtwig,grotle,torterra,chimchar,monferno,infernape,piplup,prinplup,empoleon,snivy,servine,serperior,tepig,pignite,emboar,oshawott,dewott,samurott,chespin,quilladin,chesnaught,fennekin,braixen,delphox,froakie,frogadier,greninja,rowlet,dartrix,decidueye,litten,torracat,incineroar,popplio,brionne,primarina,grookey,thwackey,rillaboom,scorbunny,raboot,cinderace,sobble,drizzile,inteleon,sprigatito,floragato,meowscarada,fuecoco,crocalor,skeledirge,quaxly,quaxwell,quaquaval".split(",");

export const EEVEELUTIONS = "eevee,vaporeon,jolteon,flareon,espeon,umbreon,leafeon,glaceon,sylveon".split(",");

// Headliners: the names most often at the top of chase lists.
export const HEADLINERS = "pikachu,charizard,umbreon,mew,mewtwo,gengar,rayquaza,lugia".split(",");

// Other widely collected Pokemon.
export const POPULAR = "greninja,lucario,gardevoir,snorlax,dragonite,gyarados,lapras,sylveon,espeon,tyranitar,garchomp,mimikyu,ho-oh,giratina,arceus,darkrai,zoroark,dragapult,blaziken,jigglypuff,psyduck,ditto,magikarp,ceruledge,armarouge,miraidon,koraidon,pikachu".split(",");

export const WEIGHTS = { headliner: 3, eeveelution: 2, gen1: 2, starter: 1.5, popular: 1 };
export const WEIGHT_CAP = 5;

export function monName(cardName) {
  let s = String(cardName || "").toLowerCase().replace(/\s*\(.*$/, "").replace(/\s*-\s*\d.*$/, "").trim();
  s = s.replace(/^(mega|m|dark|radiant|shiny|alolan|galarian|hisuian|paldean|team rocket's|[a-z]+'s)\s+/, "");
  s = s.replace(/\s+(ex|v|vmax|vstar|gx|lv\.x|star)$/, "");
  return s.trim();
}

export function popularity(cardName) {
  const n = monName(cardName);
  const first = n.split(" ")[0];
  const has = (list) => list.includes(n) || list.includes(first);
  const tags = [];
  if (has(HEADLINERS)) tags.push("headliner");
  if (has(EEVEELUTIONS)) tags.push("eeveelution");
  if (has(GEN1)) tags.push("gen1");
  if (has(STARTERS)) tags.push("starter");
  if (has(POPULAR) && !tags.length) tags.push("popular");
  const weight = Math.min(WEIGHT_CAP, tags.reduce((a, t) => a + WEIGHTS[t], 0));
  return { mon: n, tags, weight };
}
