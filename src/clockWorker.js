self.onmessage = function(e) {
    if (e.data === 'start') {
        // Start sending time updates every second
        setInterval(() => {
            const now = new Date();
            self.postMessage({
                hours: now.getHours().toString().padStart(2, '0'),
                minutes: now.getMinutes().toString().padStart(2, '0'),
                seconds: now.getSeconds().toString().padStart(2, '0'),
                date: now.toLocaleDateString()
            });
        }, 1000);
    }
};