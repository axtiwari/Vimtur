const sqlite3 = require('sqlite3').verbose()
const path = require('path');
const fs = require('fs');
const MediaManager = require('../manager.js');

class SQLiteDatabase extends MediaManager {
    constructor(config) {
        super(config);
        this.db = null;
    }

    async loadDefaultSql() {
        return new Promise((resolve, reject) => {
            fs.readFile(path.resolve(path.dirname(__filename), 'database.sql'), 'utf8', function (err, data) {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }

    async query(query, values) {
        const $this = this;
        return new Promise((resolve, reject) => {
            try {
                $this.db.all(query, values, function (error, rows, fields) {
                    if (error) {
                        reject(new Error(`Error running query: ${query} - ${JSON.stringify(values)}: ${error}`));
                    } else {
                        if (Array.isArray(rows) && rows.length > 0) {
                            rows.map((row) => {
                                row = row.value;
                            });
                            if (rows.length > 1) {
                                resolve(rows);
                            } else {
                                resolve(rows[0]);
                            }
                        } else {
                            resolve(rows);
                        }
                    }
                });
            } catch(err) {
                reject(err)
            }
        });
    }

    async exec(query) {
        const $this = this;
        return new Promise((resolve, reject) => {
            try {
                $this.db.exec(query, function (error) {
                    if (error) {
                        reject(new Error(`Error running query: ${query} - ${JSON.stringify(values)}: ${error}`));
                    } else {
                        resolve();
                    }
                });
            } catch(err) {
                reject(err)
            }
        });
    }

    async getVersion() {
        const row = await this.query('SELECT * FROM version ORDER BY version DESC LIMIT 1');
        return row.version;
    }

    async setVersion(version) {
        await this.query('INSERT OR REPLACE INTO version(version) VALUES (?)', [version]);
    }

    async close() {
        const $this = this;
        return new Promise((resolve, reject) => {
            if ($this.rebuildTimeout) {
                clearTimeout($this.rebuildTimeout);
                $this.rebuildTimeout = null;
            }
            $this.db.close(function (err) {
                resolve();
            });
        });
    }

    async load() {
        const $this = this;
        console.log("Loading tags.");
        const tags = await this.query("SELECT * FROM tags");
        if (tags) {
            for (let i = 0; i < tags.length; i++) {
                const row = tags[i];
                if (row.tag.length > 0) {
                    super.addTag(row.tag);
                }
            }
        }

        console.log(`Tags loaded (${this.tags.length}). Loading media.`);
        const media = await this.query("SELECT * from images ORDER BY path");
        if (media) {
            for (let i = 0; i < media.length; i++) {
                const row = media[i];
                super.addMedia(row.hash, row.path, row.rotation, row.type, row.hash_date);
            }
        }
        console.log(`Media loaded (${Object.keys(this.media).length}). Loading media tags.`);

        const mediaTags = await this.query("SELECT * FROM imgtags");
        if (mediaTags) {
            for (let i = 0; i < mediaTags.length; i++) {
                const row = mediaTags[i];
                super.addTag(row.tag, row.hash);
            }
        }

        console.log("Tags loaded. Loading metdata.");
        const metadata = await this.query("SELECT * from cached");
        if (metadata) {
            for (let i = 0; i < metadata.length; i++) {
                const row = metadata[i];
                super.updateMedia(row.hash, {
                    metadata: {
                        width: row.width,
                        height: row.height,
                        length: row.length,
                        artist: row.artist,
                        album: row.album,
                        title: row.title
                    }
                });
            }
        }

        console.log("Metadata loaded. Loading corrupted file list.");
        const corrupted = await this.query("SELECT * from corrupted");
        if (corrupted) {
            console.log(`${corrupted.length} files marked as corrupted`);
            for (let i = 0; i < corrupted.length; i++) {
                const row = corrupted[i];
                super.updateMedia(row.hash, { corrupted: true });
            }
        }

        console.log("Corrupted list loaded. Marking files for priority/re-transcoding.");
        const transcode = await this.query("SELECT * from priority_transcode");
        if (transcode) {
            console.log(`${transcode.length} files marked for priority transcoding`);
            for (let i = 0; i < transcode.length; i++) {
                const row = transcode[i];
                super.updateMedia(row.hash, { transcode: true });
            }
        }

        console.log("Files marked.");
    }

    async updateMedia(hash, args) {
        if (super.updateMedia(hash, args)) {
            const media = this.media[hash];
            if (args.path !== undefined) {
                await this.query('UPDATE images SET path=? WHERE hash=?', [media.path, media.hash]);
            }
            if (args.rotation !== undefined) {
                await this.query('UPDATE images SET rotation=? WHERE hash=?', [media.rotation, media.hash]);
            }
            if (args.type !== undefined) {
                await this.query('UPDATE images SET type=? WHERE hash=?', [media.type, media.hash]);
            }
            if (args.hashDate !== undefined) {
                await this.query('UPDATE images SET hash_date=? WHERE hash=?', [media.hashDate, media.hash]);
            }
            if (args.metadata) {
                // Effects zero rows if it has no metadata.
                await this.query("UPDATE cached SET artist=?, album=?, title=? WHERE hash=?",
                          [media.metadata.artist, media.metadata.album, media.metadata.title, media.hash]);
                // If there's already metadata then skip this.
                await this.query("INSERT OR IGNORE INTO cached (hash, width, height, length, artist, album, title) VALUES (?, ?, ?, ?, ?, ?, ?)",
                          [media.hash, media.metadata.width, media.metadata.height, media.metadata.length, media.metadata.artist, media.metadata.album,
                           media.metadata.title]);
            }
            if (args.corrupted !== undefined) {
                if (args.corrupted) {
                    await this.query("INSERT OR IGNORE INTO corrupted (hash) VALUES (?)", [media.hash]);
                } else {
                    await this.query("DELETE FROM corrupted WHERE hash=?", [media.hash]);
                }
            }
            if (args.transcode !== undefined) {
                if (args.transcode) {
                    await this.query("INSERT OR IGNORE INTO priority_transcode (hash) VALUES (?)", [media.hash]);
                } else {
                    await this.query("DELETE FROM priority_transcode WHERE hash=?", [media.hash]);
                }
            }
            return true;
        } else if (super.addMedia(args.hash, args.path, 0, args.type, args.hashDate)) {
            const media = this.media[hash];
            await this.query('INSERT INTO images (hash, path, type, hash_date) VALUES (?, ?, ?, ?)', [media.hash, media.path, media.type, media.hashDate]);
            return true;
        }
        return false;
    }

    async removeMedia(media) {
        if (super.removeMedia(media)) {
            await this.query('INSERT OR IGNORE INTO deleted (hash, time) VALUES (?, ?)', [media.hash, Math.floor(Date.now() / 1000)]);
            await this.query('DELETE FROM imgtags WHERE hash=?', [media.hash]);
            await this.query("DELETE FROM cached WHERE hash=?", [media.hash]);
            await this.query("DELETE FROM priority_transcode WHERE hash=?", [media.hash]);
            await this.query("DELETE FROM corrupted WHERE hash=?", [media.hash]);
            await this.query('DELETE FROM images WHERE hash=?', [media.hash]);
            return true;
        }
        return false;
    }

    async addTag(tag, hash) {
        if (super.addTag(tag, hash)) {
            if (hash) {
                await this.query('INSERT OR IGNORE INTO imgtags VALUES(?, ?)', [hash, tag]);
            } else {
                await this.query('INSERT OR IGNORE INTO tags VALUES(?)', [tag]);
            }
            return true;
        }
        return false;
    }

    async removeTag(tag, hash) {
        if (super.removeTag(tag, hash)) {
            if (hash) {
                await this.query('DELETE FROM imgtags WHERE hash=? AND tag=?', [hash, tag]);
            } else {
                await this.query('DELETE FROM imgtagss WHERE tag=?', [tag]);
                await this.query('DELETE FROM tags WHERE tag=?', [tag]);
            }
            return true;
        }
        return false;
    }

    async connect(path) {
        const $this = this;
        return new Promise((resolve, reject) => {
            try {
                const local_db = new sqlite3.Database(path, err => {
                    if (err) {
                        reject(err);
                    } else {
                        $this.db = local_db;
                        resolve();
                    }
                });
            } catch(err) {
                reject(err);
            }
        });
    }
}

async function setup(config) {
    const db = new SQLiteDatabase(config);
    await db.connect(config.database.path);
    console.log(`Using database: sqlite3://${config.database.path}`);
    console.log("SQLite3 database connected.");
    const setupQuery = await db.loadDefaultSql();
    await db.exec(setupQuery);
    const version = await db.getVersion();
    switch(version) {
        default: break
    }
    console.time('Database load took');
    await db.load();
    await db.setup();
    console.timeEnd('Database load took');

    return db;
}

module.exports = {
    setup
};
