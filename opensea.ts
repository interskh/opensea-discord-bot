import fetch from 'node-fetch';

export class OpenSeaClient {

    public attemptsBeforeSuccess: Map<string, number>;

    constructor () {
        this.attemptsBeforeSuccess = new Map();
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
                this.attemptsBeforeSuccess.set(slug, attemptCount + 1);
            } else {
                this.attemptsBeforeSuccess.set(slug, 1);
            }
            await new Promise(r => setTimeout(r, 2000));
            return this.stats(slug);
        });
    }
}
