export class logger {
    // debug | prod | info 
    static typeLogging = 'info';

    static log() {
        if(logger.typeLogging == 'prod') {
            return;
        }
        var args = Array.prototype.slice.call(arguments);
        
        if(args.length < 2) {
            return ['Too few arguments. Usage : log(objectToShow, mess1, mess2, ...)'];
        }

        var message = [];
        for(var i=1 ; i<args.length ; i++) {
            message.push(args[i]);
        }

        if(logger.typeLogging == 'debug') {
            if(args[0] != null) {
                message.push('\n');
                message.push(args[0]);
            }
        }
        return message;
    };
};

module.exports = logger;