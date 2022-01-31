import fetch from 'node-fetch';

export class OpenSeaClient {

    public attemptsBeforeSuccess: Map<string, number>;
    private _timeout: number;

    constructor () {
        this.attemptsBeforeSuccess = new Map();
        this._timeout = 2000;
    }

    async stats (slug: string): Promise<number> {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 7000);
        console.log(`Api fetch for ${slug}`);
        return fetch(`https://api.opensea.io/api/v1/collection/${slug}/stats`, {
            signal: controller.signal,
            headers: {'X-API-KEY': process.env.OPENSEA_TOKEN}
        }).then((res) => {
            return res.json().then((data) => {
                if (data.detail?.includes("throttled")) {
                    console.log(data);
                    throw new Error(data.detail);
                }
		        console.log(`Floor price is ${data.stats.floor_price}`)
                return data.stats;
            });
        }).catch(async (e) => {
            console.log(e);
            if (this.attemptsBeforeSuccess.has(slug)) {
                const attemptCount = this.attemptsBeforeSuccess.get(slug)!;
                console.log(`Attempt count is ${attemptCount}`);
                if (attemptCount > 5) {
                    console.log(`Failed to fetch ${slug} after 5 attempts`);
                    return {};
                }
                this._timeout += 1000;
                this.attemptsBeforeSuccess.set(slug, attemptCount + 1);
            } else {
                this._timeout += 1000;
                this.attemptsBeforeSuccess.set(slug, 1);
            }
            await new Promise(r => setTimeout(r, this._timeout));
            return this.stats(slug);
        });
    }
    
    async events (slug: string, type: string, since: number = 0): Promise<Array<any>> {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 60 * 1000);
        console.log(`Api fetch for ${slug}`);
        var params = {
            collection_slug: slug,
            event_type: type,
            only_opensea: "false",
            limit: "20",
            offset: "0",
            occurred_after: since.toString(),
        };
        console.log(params);
        return fetch(`https://api.opensea.io/api/v1/events?` + new URLSearchParams(params), {
            signal: controller.signal,
            headers: {'X-API-KEY': process.env.OPENSEA_TOKEN, 'Accept': 'application/json'}
        }).then((res) => {
            return res.json().then((data) => {
                console.log(data);
                if (data.detail?.includes("throttled")) {
                    console.log(data);
                    throw new Error(data.detail);
                }
                return data.asset_events;
            });
        }).catch(async (e) => {
            console.log(e);
            if (this.attemptsBeforeSuccess.has(slug)) {
                const attemptCount = this.attemptsBeforeSuccess.get(slug)!;
                console.log(`Attempt count is ${attemptCount}`);
                if (attemptCount > 5) {
                    console.log(`Failed to fetch ${slug} after 5 attempts`);
                    return {};
                }
                this._timeout += 1000;
                this.attemptsBeforeSuccess.set(slug, attemptCount + 1);
            } else {
                this._timeout += 1000;
                this.attemptsBeforeSuccess.set(slug, 1);
            }
            await new Promise(r => setTimeout(r, this._timeout));
            return this.events(slug, type, since);
        });
    }
}
