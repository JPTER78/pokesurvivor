/* ============ natures.js — GENERADO, no editar a mano ============
 * Las 25 naturalezas: +10 % a un stat (up) y −10 % a otro (down); 5 son neutras.
 * Stats: pa Ataque · sa Ataque Especial · df Defensa · sd Defensa Especial · spd Velocidad.
 * Sacado del PR #236 de TheAdro7 (datos de PokeAPI) el 20-10-2026.
 * Nombres: [es, en, fr, it, zh-Hans, zh-Hant] (pt-BR usa el inglés, como los
 * movimientos); van aquí y no en el diccionario porque "Potencia", "Imán" o
 * "Rara" ya significan otra cosa allí. Ver G.Mons.name().
 */
G.NATURES = [
  {"id":"hardy","n":["Fuerte","Hardy","Hardi","Ardita","勤奋","勤奮"],"up":"","down":""},
  {"id":"bold","n":["Osada","Bold","Assuré","Sicura","大胆","大膽"],"up":"df","down":"pa"},
  {"id":"modest","n":["Modesta","Modest","Modeste","Modesta","内敛","內斂"],"up":"sa","down":"pa"},
  {"id":"calm","n":["Serena","Calm","Calme","Calma","温和","溫和"],"up":"sd","down":"pa"},
  {"id":"timid","n":["Miedosa","Timid","Timide","Timida","胆小","膽小"],"up":"spd","down":"pa"},
  {"id":"lonely","n":["Huraña","Lonely","Solo","Schiva","怕寂寞","怕寂寞"],"up":"pa","down":"df"},
  {"id":"docile","n":["Dócil","Docile","Docile","Docile","坦率","坦率"],"up":"","down":""},
  {"id":"mild","n":["Afable","Mild","Doux","Mite","慢吞吞","慢吞吞"],"up":"sa","down":"df"},
  {"id":"gentle","n":["Amable","Gentle","Gentil","Gentile","温顺","溫順"],"up":"sd","down":"df"},
  {"id":"hasty","n":["Activa","Hasty","Pressé","Lesta","急躁","急躁"],"up":"spd","down":"df"},
  {"id":"adamant","n":["Firme","Adamant","Rigide","Decisa","固执","固執"],"up":"pa","down":"sa"},
  {"id":"impish","n":["Agitada","Impish","Malin","Scaltra","淘气","淘氣"],"up":"df","down":"sa"},
  {"id":"bashful","n":["Tímida","Bashful","Pudique","Ritrosa","害羞","害羞"],"up":"","down":""},
  {"id":"careful","n":["Cauta","Careful","Prudent","Cauta","慎重","慎重"],"up":"sd","down":"sa"},
  {"id":"rash","n":["Alocada","Rash","Foufou","Ardente","马虎","馬虎"],"up":"sa","down":"sd"},
  {"id":"jolly","n":["Alegre","Jolly","Jovial","Allegra","爽朗","爽朗"],"up":"spd","down":"sa"},
  {"id":"naughty","n":["Pícara","Naughty","Mauvais","Birbona","顽皮","頑皮"],"up":"pa","down":"sd"},
  {"id":"lax","n":["Floja","Lax","Lâche","Fiacca","乐天","樂天"],"up":"df","down":"sd"},
  {"id":"quirky","n":["Rara","Quirky","Bizarre","Furba","浮躁","浮躁"],"up":"","down":""},
  {"id":"naive","n":["Ingenua","Naive","Naïf","Ingenua","天真","天真"],"up":"spd","down":"sd"},
  {"id":"brave","n":["Audaz","Brave","Brave","Audace","勇敢","勇敢"],"up":"pa","down":"spd"},
  {"id":"relaxed","n":["Plácida","Relaxed","Relax","Placida","悠闲","悠閒"],"up":"df","down":"spd"},
  {"id":"quiet","n":["Mansa","Quiet","Discret","Quieta","冷静","冷靜"],"up":"sa","down":"spd"},
  {"id":"sassy","n":["Grosera","Sassy","Malpoli","Vivace","自大","自大"],"up":"sd","down":"spd"},
  {"id":"serious","n":["Seria","Serious","Sérieux","Seria","认真","認真"],"up":"","down":""}
];
G.NATURE_BY = {};
for (const n of G.NATURES) G.NATURE_BY[n.id] = n;
