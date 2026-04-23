const app = Vue.createApp({
    data() {
        return {
            year: '',
            country: ''
        }
    },
    methods: {
        displayResult() {
            if (year !== '' && country !== '') {
                console.log('Born: ' + this.year + '\n')
                console.log('Country: ' + this.country + '\n')
            }
        }
    },
    mounted() {
        console.log('mounted')
    }
});

app.mount('#app')