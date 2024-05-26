import { run } from '@grammyjs/runner';
import { bot } from './bot';

const runBot = () => {
    if (!bot.isInited()) {
        console.log('FILTER BOT INITIATED');
        run(bot);
    }
};

const runApp = async () => {
    try {
        runBot();
    } catch (error: any) {
        console.log(`${error.stack.toString()}`)
    }
};

runApp();
