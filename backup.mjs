import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,existsSync,chmodSync} from 'node:fs';
import {resolve} from 'node:path';
if(process.env.DATABASE_URL||process.env.DATABASE_PRISMA_DATABASE_URL||process.env.DATABASE_POSTGRES_URL)throw Error('Für PostgreSQL bitte die Sicherungsfunktion des Anbieters oder pg_dump verwenden.');
const source=resolve('.data/lessing.sqlite');
if(!existsSync(source))throw Error('Keine lokale Datenbank vorhanden. Website zuerst starten.');
mkdirSync('backups',{recursive:true,mode:0o700});
const destination=resolve('backups','lessing-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite');
const db=new DatabaseSync(source);try{db.prepare('VACUUM INTO ?').run(destination);chmodSync(destination,0o600);console.log('Sicherung erstellt: '+destination)}finally{db.close()}
