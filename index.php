<!DOCTYPE html>
<html lang="en" >
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>Movetodon: Find your Twitter Friends on Mastodon</title>
    <link href="https://www.movetodon.org" rel="canonical"/>
    <meta property="og:title" content="Movetodon: Finds your Twitter Friends on Mastodon"/>
    <meta property="og:image" content="https://www.movetodon.org/og.jpg">
    <meta name="twitter:card" content="summary_large_image">
    <meta property="twitter:image" content="https://www.movetodon.org/og.jpg">
    <style>
        <?php include_once 'style.css'; ?>
    </style>
</head>
<body>
<main class="mw mwmain">
    <div id="app" class="mt10" v-cloak>
        <div v-if="!twitterLoggedIn" class="tac" v-cloak>
            <section class="login">
                <h1 class="fs125"><span class="accent">First step: Login with Twitter</span></h1>
                <a href="/twitterlogin" class="pt025 pr05 pb025 pl05 button mt10 cp br025 bggrad">Login</a>
                <p class="mt10">We need this to take a look if your friends from Twitter have a @mastodon linked to their profile 🧐</p>
            </section>
        </div>
        <div v-else-if="twitterLoggedIn && !mastodonLoggedIn" class="tac mt10" v-cloak>
            <section class="login loggedin">
                <h1 class="fs125"><span class="accent">✅ First step: you’re logged in with twitter</span></h1>
            </section>
            <section class="login mt10">
                <h1 class="fs125"><span class="accent">Second step: Login with Mastodon</span></h1>
                <form @submit.prevent="openMastodon" class="mt10">
                    <label for="mastodondomain">Enter Mastodon Domain</label><br>
                    <input type="text" @input="setMastodonDomain" id="mastodondomain" class="pt025 pr05 pb025 pl05 br025 mt05">
                    <input type="submit" value="Login" v-if="mastodonDomain" class="bggrad pt025 pr05 pb025 pl05 br025 cfff ml05">
                </form>
                <p class="mt10">We use this so you can follow/unfollow your friends on Mastodon easily 🤝</p>
            </section>
        </div>
        <section v-else>
            <div class="df jcsb pt05 pr05 aib">
                <div>
                    <p><span class="accent"><strong>{{twitterFriendsChecked}} / {{twitterFriendsTotal}}</strong></span> Friends checked, {{Object.keys(usersObject).length}} found</p>
                    <p v-if="fetchPause && fetchPauseSeconds > 0" class="mt05">Waiting for the API, <span class="accent">script continues in {{fetchPauseSeconds}} seconds</span> ☕️</p>
                </div>
                <button @click.prevent="logout" class="pt025 pr05 pb025 pl05 cp br025 bggrad">Logout</button></div>
            <div class="mt10">
                <input type="checkbox" v-model="filterNotFollowed" id="filterNotFollowed" style="position: absolute; left: -500rem">
                <label for="filterNotFollowed" class="pt025 pr05 pb025 pl05 bggrad br025">{{filterNotFollowed ? 'Show' : 'Hide'}} followed accounts</label>
            </div>
            <div class="oxs mt10" v-if="usersArray.length > 0">
                <table class="mw100 miw100">
                    <tr>
                        <th></th>
                        <th></th>
                        <th @click="sortByValue('mastodonAge')" class="pt05 pr05 pb05 pl05 cp">Joined {{sortIndicator('mastodonAge')}}</th>
                        <th @click="sortByValue('mastodonRecentPostAge')" class="pt05 pr05 pb05 pl05 cp">Active {{sortIndicator('mastodonRecentPostAge')}}</th>
                        <th class="pt05 pr05 pb05 pl05"><button @click.prevent="followAll()" class="pt025 pr05 pb025 pl05 button bggrad br025">Follow all</button></th>
                    </tr>
                    <tr v-for="user in usersArray" :key="user.userId">
                        <td class="pt025 pr025 pb025 pl05"><img :src="user.profileImage" class="br100" width=40 height=40 loading=lazy></td>
                        <td class="pt025 pr05 pb025 pl05" :title="user.description"><strong>{{user.userName}}</strong>
                        <div class="fs0625 cp">T: <a :href="'https://twitter.com/' + user.twitterHandle" rel="noopener nofollow" class="noa" target="_blank">@{{user.twitterHandle}}</a><br>
                        M: <a :href="user.mastodonUrl" target="_blank" class="noa" rel="noopener nofollow">{{user.mastodonHandle}}</a></div></td>
                        <td class="pt025 pr05 pb025 pl05">{{Math.round(user.mastodonAge)}} Days</td>
                        <td class="pt025 pr05 pb025 pl05">{{Math.round(user.mastodonRecentPostAge) > 1000 ? '/' : Math.round(user.mastodonRecentPostAge)}} Days</td>
                        <td class="pt025 pr05 pb025 pl05"><button @click.prevent="followMastodonUser(user)" :class="'pt025 pr05 pb025 pl05 br025 cp mastodonButton ' +  (user.mastodonFollowing ? 'button transparent' : '')">{{user.mastodonFollowing? 'Following' : 'Follow'}}</button></td>
                    </tr>
                </table>
            </div>
        </section>
    </div>
</main>
<footer class="tac mt10 mw mwmain pb05">
    <a rel="me" href="https://mastodon.social/@Tibor">I’m @tibor@mastodon.social</a>
</footer>
<script src='/vue.global.prod.min.js'></script>
<?php if(isset($_GET['debug'])):?>
<script src="/script.js?<?php echo filemtime('new.js'); ?>"></script>
<?php else:?>
<script src="/script.js?<?php echo filemtime('script.js'); ?>"></script>
<?php endif;?>
</body>
</html>
