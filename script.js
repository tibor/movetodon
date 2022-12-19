const { createApp } = Vue;

createApp({
    data() {
        return {
            domain: "https://www.movetodon.org",
            twitterLoggedIn: false,
            mastodonLoggedIn: false,
            twitterToken: {},
            mastodonToken: {},
            mastodonDomain: null,
            users: new Set(),
            usersObject: {},
            usersArray: [],
            mastodonUsers: {},
            sortBy: "mastodonAge",
            sortByOrder: 1,
            twitterFriendsTotal: 0,
            twitterFriendsChecked: 0,
            twitterCheckedSet: new Set(),
            filterNotFollowed: false,
            fetchPause: null,
            fetchPauseSeconds: 0,
            interval: null
        };
    },
    methods: {
        login() {
            !this.twitterLoggedIn && this.getTwitterToken();
            !this.mastodonLoggedIn && this.getMastodonToken();
            if (!this.mastodonLoggedIn || !this.twitterLoggedIn) return
            this.getTwitterIds(-1);
            this.getMastodonFriends(
                `https://${this.mastodonDomain}/api/v1/accounts/${this.mastodonToken.id}/following?limit=80`,
                null
            );
        },
        setMastodonDomain(event) {
            const domainRegex = /([^\s@\/]+\.\w+)($|\/)/;
            let domain;
            if ((domain = event.target.value.match(domainRegex))) {
                this.mastodonDomain = domain[1].toLowerCase();
                localStorage.setItem("mastodonDomain", this.mastodonDomain)
            }
        },
        getTwitterToken() {
            let token;
            if ((token = JSON.parse(localStorage.getItem("twitterToken")))) {
                this.twitterToken = token;
                this.twitterLoggedIn = true;
                return;
            }
            fetch(`${this.domain}/get_token/twitter${window.location.search}`)
                .then((a) => a.json())
                .then((a) => {
                    this.twitterToken.token = a.oauth_token;
                    this.twitterToken.secret = a.oauth_token_secret;
                    this.twitterToken.account = a.screen_name;
                    localStorage.setItem(
                        "twitterToken",
                        JSON.stringify(this.twitterToken)
                    );
                    this.twitterLoggedIn = true;
                    window.location = this.domain;
                });
        },
        getMastodonToken() {
            this.mastodonDomain = localStorage.getItem('mastodonDomain')
            let token;
            if ((token = JSON.parse(localStorage.getItem("mastodonToken")))) {
                this.mastodonToken = token;
                //this.mastodonToken.auth = token.auth;
                //this.mastodonToken.id = token.id;
                if(this.mastodonToken.auth) this.mastodonLoggedIn = true;

                if (window.location?.search.includes("code")){
                    const params = {};
                    const urlParams = window.location.search.substr(1);
                    urlParams.split("&").forEach((param) => {
                        let p = param.split("=");
                        params[p[0]] = p[1];
                    });
                    if (params.code) {
                        fetch(
                            `${this.domain}/get_token/mastodon/?code=${params.code}&grant_type=authorization_code&client_id=${this.mastodonToken.client_id}&client_secret=${this.mastodonToken.client_secret}&domain=https://${this.mastodonDomain}`
                        )
                            .then((bearer) => bearer.json())
                            .then((bearer) => {
                                this.mastodonToken.auth = bearer.access_token;
                                let headers = {
                                    Authorization: "Bearer " + this.mastodonToken.auth
                                };
                                fetch(
                                    `https://${this.mastodonDomain}/api/v1/accounts/verify_credentials`,
                                    { headers }
                                )
                                    .then((a) => a.json())
                                    .then((profile) => {
                                        this.mastodonLoggedIn = true;
                                        this.mastodonToken.id = profile.id;
                                        localStorage.setItem(
                                            "mastodonToken",
                                            JSON.stringify(this.mastodonToken)
                                        );
                                        window.location = '/';
                                    });
                            });
                    }
                }
            }
        },
        openMastodon(){
            const formData = new FormData();
            formData.append("client_name", "Movetodon");
            formData.append("redirect_uris", this.domain);
            formData.append("scopes", "read:accounts read:follows follow");
            formData.append("website", this.domain);
            fetch(`https://${this.mastodonDomain}/api/v1/apps`, {
                method: "POST",
                body: formData
            })
                .then((a) => a.json())
                .then((a) => {
                    this.mastodonToken.client_id = a.client_id;
                    this.mastodonToken.client_secret = a.client_secret;
                    localStorage.setItem(
                        "mastodonToken",
                        JSON.stringify(this.mastodonToken)
                    );
                    if(a?.error) window.location = '/'
                })
                .then( () =>
                    (window.location = `https://${
                        this.mastodonDomain
                    }/oauth/authorize?client_id=${
                        this.mastodonToken.client_id
                    }&response_type=code&redirect_uri=${encodeURI(this.domain)}&scope=read:accounts+read:follows+follow`)
                );
        },
        getTwitterIds(cursor) {
            let params = {
                cursor: cursor,
                count: 5000,
                screen_name: this.twitterToken.account,
                stringify_ids: true
            };
            fetch(
                `${this.domain}/api/?oauth_token=${
                    this.twitterToken["token"]
                }&oauth_token_secret=${
                    this.twitterToken["secret"]
                }&api=friends/ids&params=${JSON.stringify(params)}`
            )
                .then((a) => {
                    if(a.status >= 400) throw new Error('API Fehler')
                    return a.json()
                })
                .then((a) => {
                    if (a.ids) {
                        a.ids.forEach((id) => this.users.add(id));
                        this.twitterFriendsTotal += a.ids.length
                    }
                    if (a.next_cursor) {
                        this.getTwitterIds(a.next_cursor);
                    } else {
                        this.getTwitterFriendsList(-1);
                    }
                })
                .catch( () => this.pause(60000).then( () => this.getTwitterIds(cursor) ) );
        },
        getTwitterFriendsList(){
            if(this.users.size === 0) return;
            const idsplice = [...this.users].splice(0,100)
            const ids = idsplice.join(',')
            let params = {
                ids,
                "user.fields": "location,url,description,entities,profile_image_url",
                expansions: "pinned_tweet_id",
                "tweet.fields": "author_id,entities"
            }
            //idsplice.forEach(id => this.users.delete(id))
            fetch(`${this.domain}/api/?api=users&params=${encodeURI(JSON.stringify(params))}&oauth_token=${this.twitterToken.token}&oauth_token_secret=${this.twitterToken.secret}&use=2`)
                .then( a => {
                    if(!a.ok) throw new Error('API Fehler')
                    return a.json()
                })
                .then( users => {
                    /*if(users?.errors){
                        this.pause(a?.seconds * 1000 || 60000)
                            .then( () => this.getTwitterFriendsList() )
                        throw new Error('break')
                    }*/
                    users.data.forEach( user => {
                        this.users.delete(user.id)
                        user.tweet = users.includes.tweets.find( tweet => tweet.id === user.pinned_tweet_id )
                        this.addUserToUsersObject(user);
                    })
                } )
                .then( () => this.pause(0).then( () => this.getTwitterFriendsList() ) )
                .catch( () => this.pause(60000).then(() => this.getTwitterFriendsList()))
        },
        getTwitterUser(twitterUserId, remainingUsers) {
            if(this.twitterCheckedSet.has(twitterUserId)){
                this.users.delete(twitterUserId);
                console.group();
                console.log(twitterUserId);
                [twitterUserId] = this.users;
                console.log(twitterUserId);
                console.groupEnd();
                this.getTwitterUser( twitterUserId, remainingUsers );
                return;
            }
            let params = {
                user_id: twitterUserId
            };
            fetch(
                `${this.domain}/api/?oauth_token=${
                    this.twitterToken.token
                }&oauth_token_secret=${
                    this.twitterToken.secret
                }&api=users/show&params=${encodeURI(JSON.stringify(params))}`
            )
                .then((a) => a.json())
                .then((a) => {
                    if (a?.errors?.[0]?.code === 88) this.pause(a?.ms || 60000).then(() => this.getTwitterUser(twitterUserId, remainingUsers))
                    if (a?.errors?.[0]?.code === 50)
                        this.users.delete(twitterUserId);
                    this.addUserToUsersObject(a);
                    if (this.users.size === 0) throw new Error('break');
                    let [firstUser] = this.users;
                    if (firstUser === twitterUserId) throw new Error('break');
                    let pause = remainingUsers > this.twitterFriendsTotal - this.twitterFriendsChecked ? 0 : a.seconds
                    this.pause(pause).then(() => this.getTwitterUser(firstUser, a.remaining));
                })
                .catch((e) => {
                    console.group();
                    console.error(
                        "Twitter User",
                        e,
                        `${this.domain}/api/?oauth_token=${
                            this.twitterToken["token"]
                        }&oauth_token_secret=${
                            this.twitterToken["secret"]
                        }&api=users/show&params=${encodeURI(
                            JSON.stringify(params)
                        )}`
                    );
                    if(!e.message === 'break') this.getTwitterUser(twitterUserId, remainingUsers)
                    console.groupEnd();
                });
        },
        getMastodonUserFromTwitter(userToCheck) {
/*            const mastodonRegex = [
                /(@[\d\w_]+@[\S]+\.[\d\w]{2,})/gi,
                /(([\d\w_]+@\S*social(\S*\.)+\w+)($|[\s\/]))/gi,
                /((^|[\s\D\W@])[\d\w_]+@\S+\.\w{4,}($|[\/\s\)]))/gi,
                /((https?:\/\/)?[\d\w\-\.]+\.\w{2,}\/@[\d\w]+)/gi,
                /([\d\w_]+@(mas|mstdn)[\d\w\-\.]*\.[\d\w]+)/gi,
                /https:\/\/\w+/,
                ((https?:\/\/)?[\d\w\-\.]+\.\w{2,}\/(web\/)?@[\d\w]+)
            ]*/
            const mastodonRegex = /(@[\d\w_]+@\S+\.[\d\w]{2,})|(([\d\w_]+@\S*social(\S*\.)+\w+)($|[\s\/]))|((^|[\s\D\W@])[\d\w_]+@\S+\.\w{4,}($|[\/\s\)]))|((https?:\/\/)?([\d\w\-]+(?=\.)\.)+\w{2,}\/(web\/)?@[\d\w]+)|([\d\w_]+@(mas|mstdn)[\d\w\-\.]*\.[\d\w]+)/gi
            let mastodonUser;
            [
                userToCheck?.status?.urls?.map(a => a.expanded_url),
                [userToCheck?.tweet?.text],
                userToCheck?.tweet?.entities?.urls?.map(a => a.expanded_url),
                [userToCheck?.status?.text],
                [userToCheck.name],
                [userToCheck.location],
                userToCheck?.entities?.url?.urls?.map(a => a.expanded_url),
                [userToCheck.description],
                userToCheck?.entities?.description?.urls?.map(a => a.expanded_url)
            ].forEach((arrToCheck) => {
                arrToCheck?.forEach(strToCheck => {
                    let matches;
                    if (
                        strToCheck &&
                        ![
                            "medium.com",
                            "tiktok.com",
                            "youtube.com",
                            "tap.bio",
                            "flipboard.com"
                        ].some((domain) => strToCheck.includes(domain)) &&
                        (matches = strToCheck.match(mastodonRegex))
                    ) {
                        mastodonUser = [this.switchMastodonHandleUrl(matches[0])];
                        let mastodonUser2
                        mastodonUser2 = matches.map( match => this.switchMastodonHandleUrl(match) )
                        console.log(matches, mastodonUser, mastodonUser2)
                    }
                })
            });
            return mastodonUser;
        },
        switchMastodonHandleUrl(mastodonStr) {
            const domainRegex = /([^\s@\/]+\.\w+)($|[\/\D\W\s])/;
            let domain = mastodonStr.match(domainRegex);
            let userhandle = mastodonStr.match(/(^|[@\D\W])([\w\d]+)(@|$)/);
            if(!userhandle?.[2] || !domain?.[1]) return;
            domain = domain[1].toLowerCase();
            userhandle = userhandle[2].toLowerCase();
            let mastodonHandle = `@${userhandle}${
                this.mastodonDomain === domain ? "" : "@" + domain
            }`.toLowerCase();
            let url = `https://${this.mastodonDomain}/@${userhandle}${
                this.mastodonDomain === domain ? "" : "@" + domain
            }`;
            let handle = `@${userhandle}@${domain}`;
            return { url, handle, mastodonHandle };
        },
        addUserToUsersObject(twitterUser) {
            if(this.twitterCheckedSet.has(twitterUser.id)) return
            let mastodonUsers;
            if ((mastodonUsers = this.getMastodonUserFromTwitter(twitterUser))) {
            mastodonUsers.forEach( (mastodonUser, mastodonUserIndex) => {
                this.getMastodonUserId(mastodonUser.mastodonHandle).then(
                    (fetchedMastodonProfile) => {
                        if(fetchedMastodonProfile.status === 429) {
                            this.fetchPause = new Date(fetchedMastodonProfile.headers.get('x-ratelimit-reset'))
                            let pause = this.fetchPause - new Date()
                            this.pause( pause || 60000 ).then( () => this.addUserToUsersObject(twitterUser) )
                            //this.twitterFriendsChecked--
                            throw new Error('break')
                        }
                        this.fetchPause = fetchedMastodonProfile.status === 200 ? null : this.fetchPause
                        if(mastodonUserIndex === 0 ) this.twitterFriendsChecked++
                        this.twitterCheckedSet.add(twitterUser.id)
                        if (!fetchedMastodonProfile.id) throw new Error('break');
                        let acct = fetchedMastodonProfile.acct
                        let profile = acct.includes('@') ? acct : acct + '@' + this.mastodonDomain
                        mastodonUser = this.switchMastodonHandleUrl(profile)
                        let userName = twitterUser.name
                            .replace(
                                new RegExp("[\\(\\s\\/\\|@]*"  + mastodonUser.handle.substr(1) + "[\\)]?", "gi"),
                                ""
                            )
                            .replace(new RegExp("(https:\\/\\/)?\\S+\\.[\\d\\w]+\\/@[\\d\\w]+", "gi"), "")
                            .replace('@' + fetchedMastodonProfile.acct, "")
                            .trim();
                        this.usersObject[
                            mastodonUser.mastodonHandle.toLowerCase()
                        ] = {
                            userId: twitterUser.id,
                            userName,
                            twitterHandle: twitterUser.username,
                            profileImage: twitterUser.profile_image_url,
                            location: twitterUser.location,
                            url: twitterUser.url,
                            description: twitterUser.description,
                            mastodonCompleteHandle: mastodonUser.handle,
                            mastodonUrl: mastodonUser.url,
                            mastodonHandle: mastodonUser.mastodonHandle,
                            mastodonFollowing: fetchedMastodonProfile?.following,
                            mastodonUserId: fetchedMastodonProfile.id,
                            mastodonAge:
                                (new Date() -
                                    new Date(
                                        fetchedMastodonProfile.created_at
                                    )) /
                                60 /
                                60 /
                                24 /
                                1000,
                            mastodonRecentPostAge:
                                (fetchedMastodonProfile.statuses_count > 0 ? (new Date() -
                                    new Date(
                                        fetchedMastodonProfile.last_status_at
                                    )) /
                                60 /
                                60 /
                                24 /
                                1000 : '5000')
                        };
                    }
                ).catch(e => {
                    if(!e.message === 'break') console.log(e)
                });
            })
            }else{
                this.twitterFriendsChecked++
                this.twitterCheckedSet.add(twitterUser.id)
            }
            this.users.delete(twitterUser.id);
        },
        getMastodonFriends(url, rel) {
            let header = {
                Authorization: "Bearer " + this.mastodonToken.auth
            };
            fetch(url, { headers: header })
                .then((a) => {
                    if(a.status === 429 || a.status >= 500){
                        this.pause(this.fetchPauseSeconds * 1000 || 60000).then(() => this.getMastodonFriends(url, rel));
                        throw new Error('break');
                    }
                    let nextLink = this.parseLinkHeaders(a.headers);
                    if (nextLink && nextLink[rel]) {
                        this.getMastodonFriends(nextLink[rel], rel);
                    } else {
                        if (nextLink?.prev)
                            this.getMastodonFriends(nextLink.prev, "prev");
                        if (nextLink?.next)
                            this.getMastodonFriends(nextLink.next, "next");
                    }
                    return a.json();
                })
                .then((a) => {
                    a.forEach((mastodonUser) => {
                        let userToAdd = '@' + mastodonUser.acct.toLowerCase()
                        this.mastodonUsers[userToAdd] = {
                            id: mastodonUser.id,
                            created_at: mastodonUser.created_at,
                            statuses_count: mastodonUser.statuses_count,
                            last_status_at: mastodonUser.last_status_at,
                            acct: mastodonUser.acct,
                            url: mastodonUser.url
                        };
                    });
                }).catch( e => {
                    if(!e.message === 'break') console.log(e)
                });
        },
        getMastodonUserId(acct) {
            let acct2
            if(acct2 = this.mastodonUsers[acct.toLowerCase()]){
                return new Promise( (resolve) => {
                    acct2['status'] = this.fetchPause ? 1000 : 200 
                    acct2['following'] = true
                    resolve(acct2)
                } )
            }
            return this.pause(this.fetchPauseSeconds * 1000 || 0).then( () => fetch(
                `https://${this.mastodonDomain}/api/v1/accounts/lookup?acct=${acct.substring(1)}&skip_webfinger=false`
            ).then((a) => {
                if(a.status === 404) this.twitterFriendsChecked++
                return a.status === 429 ? a : a.json();
            })
            .then((a) => {
                if(!a?.moved) return a
                a.id = a.moved.id;
                a.username = a.moved.username
                a.url = a.moved.url
                a.acct = a.moved.acct;
                a.last_status_at = a.moved.last_status_at;
                return a;
            } ) );
        },
        followMastodonUser(user) {
            let header = {
                Authorization: "Bearer " + this.mastodonToken.auth
            };
            let method = user.mastodonFollowing ? "unfollow" : "follow";
            fetch(
                `https://${this.mastodonDomain}/api/v1/accounts/${user.mastodonUserId}/${method}`,
                {
                    method: "POST",
                    headers: header
                }
            )
                .then((a) => {
                    if(a.status === 429){
                        this.fetchPause = new Date(a.headers.get('x-ratelimit-reset'));
                        this.pause(this.fetchPauseSeconds * 1000 || 300000).then( () => this.followMastodonUser(user));
                        throw new Error('break');
                    }
                    return a.json()
                })
                .then(
                    (a) =>
                        (this.usersObject[
                            user.mastodonHandle.toLowerCase()
                        ].mastodonFollowing = a.following || a.requested)
                );
        },
        followAll(){
            this.usersArray.filter(
                user => !user.mastodonFollowing
            ).forEach(
                user => this.pause(this.fetchPauseSeconds * 1000 || 100).then(
                    this.followMastodonUser(user)
                )
            )
        },
        parseLinkHeaders(header) {
            if (!header || !header.get("link")) return;
            let obj = {};
            header
                .get("link")
                .split(", ")
                .forEach((arr) => {
                    arr = arr.split("; ");
                    obj[
                        arr[1].split("=")[1].replaceAll('"', "")
                    ] = arr[0].substring(1, arr[0].length - 1);
                });
            return obj;
        },
        doFilterUnfollowed(){
            let usersArray = Object.values( this.usersObject )
            return this.filterNotFollowed ? usersArray.filter(user => !user.mastodonFollowing) : usersArray
        },
        pause(ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
        },
        sort() {
            let toSort = this.doFilterUnfollowed()
            this.usersArray = toSort.sort(
                (a, b) => this.sortByOrder * (a[this.sortBy] - b[this.sortBy])
            );
        },
        sortByValue(sortBy) {
            this.sortByOrder =
                this.sortBy === sortBy ? this.sortByOrder * -1 : 1;
            this.sortBy = sortBy;
        },
        sortIndicator(sortBy) {
            if (this.sortBy != sortBy) return;
            return this.sortByOrder === -1 ? "▼" : "▲";
        },
        logout() {
            localStorage.clear();
            this.mastodonToken = {};
            this.twitterToken = {};
            this.twitterLoggedIn = false;
            this.mastodonLoggedIn = false;
            window.location = "/";
        }
    },
    computed: {
        userCount() {
            return Object.keys(this.usersObject).length;
        },
        mastodonUserCount(){
            return Object.keys(this.mastodonUsers).length;
        }
    },
    watch: {
        userCount(oldUserCount, newUserCount) {
            this.sort();
            if(newUserCount === 50){
                if(window.outerWidth < 600){
                    this.pause(100).then(() => (document.querySelector('.oxs').scroll({left: 200, behavior: 'smooth'})))
                    this.pause(2000).then(() => document.querySelector('.oxs').scroll({left: 0, behavior: 'smooth'}))
                }
            }
            let mastodonUser;
            if((mastodonUser = Object.keys(this.mastodonUsers)
                .find(user => this.usersObject.hasOwnProperty(user)))){
                    this.usersObject[mastodonUser].mastodonFollowing = true;
                    delete this.mastodonUsers[mastodonUser];
            }
        },
        mastodonUserCount(){
            let mastodonUser
            if(mastodonUser = Object.keys(this.mastodonUsers)
                .find(user => this.usersObject.hasOwnProperty(user))){
                    this.usersObject[mastodonUser].mastodonFollowing = true;
                    delete this.mastodonUsers[mastodonUser];
            }
        },
        sortBy() {
            this.sort();
        },
        sortByOrder() {
            this.sort();
        },
        filterNotFollowed(){
            this.sort();
        },
        fetchPause(){
            if(!this.fetchPause) return clearInterval(this.interval);
            this.interval = setInterval( () => (this.fetchPauseSeconds = Math.round((this.fetchPause - new Date()) / 1000)), 1000 )
        }
    },
    created() {
        this.login();
    }
}).mount("#app");
