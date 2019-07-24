const queue: Function[] = [];

const terminate = async () => await Promise.all(queue.map(fn =>
    fn() // prevent one error from disrupting other shutdown processes
        .catch(err => {
            // eslint-disable-next-line no-console
            console.error(err);
            return err instanceof Error ? err : new Error(err);
        })
))
    .then(results => {
        // eslint-disable-next-line no-console
        console.log(`Run duration: ${duration(process.hrtime(starttime)[0])}`);
        process.exit(results.filter(r => r instanceof Error).length > 0 ? 1 : 0);
    });

const duration = (seconds) => [
    // [2592000, ' month', true],
    // [604800, ' week', true],
    // [86400, ' day', true],
    [86400, 'd', false],
    [3600, 'h', false],
    [60, 'm', false],
    [1, 's', false],
]
    // @ts-ignore
    .reduce(([parts, remaining]: [string[], number], [interval, abbr, pluralize]: [number, string, boolean]) => {
        if (remaining > interval) {
            const floor = Math.floor(remaining / interval);
            const plural = pluralize && floor !== 1 ? 's' : '';
            parts.push(floor.toLocaleString() + abbr + plural);
            return [parts, remaining % interval];
        } else {
            return [parts, remaining];
        }
    }, [[], seconds])[0]
    .join(' ');

export const shutdown = (fn) => {
    if (queue.indexOf(fn) === -1) {
        queue.push(fn);
    }
};

export const dequeue = (fn) => {
    const index = queue.indexOf(fn);
    if (index > -1) {
        return queue.splice(index, 1);
    }
    return false;
};

export const starttime = process.hrtime();

export const startup = async (app, port, name) => {
    if (name) {
        process.title = await name;
    }
    try {
        await app.listen(await port, '::');
        if (process.send) {
            // Intentionally sending process.send('ready') twice:
            // https://github.com/Unitech/pm2/issues/4271
            process.send('ready');
            process.send('ready');
        }
        const [seconds, nanoseconds] = process.hrtime(starttime);
        // eslint-disable-next-line no-console
        console.log(`${name}[:${port}] startup: %s ms`, (seconds * 1000 + nanoseconds / 1e6)
            .toLocaleString(undefined, { maximumFractionDigits: 0 }));
        // eslint-disable-next-line no-console
        console.log('routes:\n', app.printRoutes());
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        process.exit(1);
    }
}

export default shutdown;

process.on('beforeExit', terminate);
process.on('SIGINT', terminate);