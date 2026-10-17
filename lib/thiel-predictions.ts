export const THIEL_ROOM_ID='thiel-nashville-2026';
export const THIEL_PATH='/thiel-nashville-2026';
export const THIEL_EVENT_URL='https://luma.com/do6chah5';
export const THIEL_TITLE='Who will Thiel name? · Nashville 2026';
export const THIEL_DESCRIPTION='Community predictions about whom or what Peter Thiel might call the Antichrist in his 2026 Nashville lectures. These picks are speculation, not confirmed statements or claims about the people listed.';
export const THIEL_PICKS=[
 {id:'sam-altman',name:'Sam Altman',mark:'SA',kind:'person'},
 {id:'elon-musk',name:'Elon Musk',mark:'EM',kind:'person'},
 {id:'dario-amodei',name:'Dario Amodei',mark:'DA',kind:'person'},
 {id:'demis-hassabis',name:'Demis Hassabis',mark:'DH',kind:'person'},
 {id:'bill-gates',name:'Bill Gates',mark:'BG',kind:'person'},
 {id:'mark-zuckerberg',name:'Mark Zuckerberg',mark:'MZ',kind:'person'},
 {id:'donald-trump',name:'Donald Trump',mark:'DT',kind:'person'},
 {id:'jd-vance',name:'JD Vance',mark:'JV',kind:'person'},
 {id:'pope-leo-xiv',name:'Pope Leo XIV',mark:'LX',kind:'person'},
 {id:'greta-thunberg',name:'Greta Thunberg',mark:'GT',kind:'person'},
 {id:'yuval-harari',name:'Yuval Noah Harari',mark:'YH',kind:'person'},
 {id:'peter-thiel',name:'Peter Thiel',mark:'PT',kind:'person'},
 {id:'no-one',name:'No individual named',mark:'Ø',kind:'outcome'},
 {id:'ai-itself',name:'AI itself',mark:'AI',kind:'outcome'},
 {id:'world-government',name:'A world government',mark:'WG',kind:'outcome'},
 {id:'someone-else',name:'Someone else',mark:'?',kind:'outcome'},
];

// Seed the requested public catalog only. Never manufacture audience rankings.
// A single atomic batch and stable IDs make concurrent first visits safe. Once
// created, admin edits and hidden candidates are left untouched on future reads.
export async function ensureThielPredictions(db:D1Database,time=Date.now()){
 if(await db.prepare('SELECT id FROM rooms WHERE id=?').bind(THIEL_ROOM_ID).first())return;
 await db.batch([
  db.prepare("INSERT OR IGNORE INTO rooms (id,title,description,videoId,status,createdAt,revision) VALUES (?,?,?,NULL,'open',?,1)").bind(THIEL_ROOM_ID,THIEL_TITLE,THIEL_DESCRIPTION,time),
  ...THIEL_PICKS.map((pick,index)=>db.prepare("INSERT OR IGNORE INTO moments (id,roomId,title,description,category,timestamp,image,status,createdBy,ipHash,createdAt,origin) VALUES (?,?,?,?,?,0,?,'approved','system','system',?,?)").bind('thiel26-'+pick.id,THIEL_ROOM_ID,pick.name,pick.kind==='person'?'A community prediction option. Inclusion does not mean Thiel has named this person, and makes no claim about them.':'An alternative prediction outcome. No result has been verified on this board.',pick.kind==='person'?'Guest':'Moment','/predictions/'+pick.id+'.svg',time+index,'thiel26:'+pick.id)),
  db.prepare("INSERT INTO settings (key,value) VALUES ('catalogRevision','1') ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT)")
 ]);
}
