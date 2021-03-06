var app = angular.module('flapperNews', ['ui.router']);

app.config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider){

	$stateProvider
		.state('home', {
		  url: '/home',
		  templateUrl: '/views/home.html',
		  controller: 'MainCtrl',
		  resolve: {
		    postPromise: ['posts', 'auth', function(posts, auth){
		      return posts.getAll(auth.currentUser());
		    }]
		  },
		 	onEnter: ['$state', 'auth', function($state, auth){
				if(!auth.isLoggedIn()){
					$state.go('login');
				}
			}]
		})
		.state('posts', {
			url: '/posts/{id}',
			templateUrl: '/views/posts.html',
			controller: 'PostsCtrl',
			resolve: {
				post: ['$stateParams', 'posts', function($stateParams, posts) {
					return posts.get($stateParams.id);
				}]
			},
			onEnter: ['$state', 'auth', function($state, auth){
				if(!auth.isLoggedIn()){
					$state.go('login');
				}
			}]
		})
		.state('login', {
			url: '/login',
			templateUrl: '/views/login.html',
			controller: 'AuthCtrl',
			onEnter: ['$state', 'auth', function($state, auth){
				if(auth.isLoggedIn()){
					$state.go('home');
				}
			}]
		})
		.state('register', {
			url: '/register',
			templateUrl: '/views/register.html',
			controller: 'AuthCtrl',
			onEnter: ['$state', 'auth', function($state, auth){
				if(auth.isLoggedIn()){
					$state.go('home');
				}
			}]
		})

	$urlRouterProvider.otherwise('login');

}]);

app.factory('auth', ['$http', '$window', function($http, $window){
	var auth = {};

	auth.saveToken = function(token){
		$window.localStorage['flapper-news-token'] = token;
	};

	auth.getToken = function (){
		return $window.localStorage['flapper-news-token']
	};

	auth.isLoggedIn = function(){
		var token = auth.getToken();

		if(token){
			var payload = JSON.parse($window.atob(token.split('.')[1]));

			return payload.exp > Date.now() / 1000;
		} else {
			return false;
		}

	};

	auth.currentUser = function() {
		if(auth.isLoggedIn()){
			var token = auth.getToken();
			var payload = JSON.parse($window.atob(token.split('.')[1]));

			return payload.username;
		}
	};

	auth.register = function(user){
		return $http.post('/register', user).success(function(data){
			auth.saveToken(data.token);
		});
	};

	auth.logIn = function(user){
		return $http.post('/login', user).success(function(data){
			auth.saveToken(data.token);
		});
	};

	auth.logOut = function(){
		$window.localStorage.removeItem('flapper-news-token');
	};

	return auth;

}])

app.factory('posts', ['$http', 'auth', function($http, auth){

	var o = { posts:[] };

	// post methods

  o.getAll = function(currentUser) {
		$http.get('/posts', {params: {currentUser: currentUser}}).success(function(data){
      angular.copy(data, o.posts);
    });
  };

	o.create = function(post) {
	  return $http.post('/posts', post, {
	  	headers: {Authorization: 'Bearer '+auth.getToken()}
	  }).success(function(data){
	    o.posts.push(data);
	  });
	};

	o.upvote = function(post) {
		return $http.put('/posts/' + post._id + '/upvote', null, {
	  	headers: {Authorization: 'Bearer '+auth.getToken()}
	  }).success(function(data){
				post.upvotes += 1;
			});
	};

	o.get = function(id) {
		return $http.get('/posts/' + id).then(function(res) {
			return res.data;
		});
	};

	o.delete = function(post) {
		return $http.delete('/posts/' + post._id).then(function(res) {
			console.log(res.data);
		});
	};

	// comments methods

	o.addComment = function(id, comment) {
		return $http.post('/posts/' + id + '/comments', comment, {
	  	headers: {Authorization: 'Bearer '+auth.getToken()}
	  });
	};

	o.upvoteComment = function(post, comment) {
		return $http.put('/posts/' + post._id + '/comments/' + comment._id + '/upvote', null, {
	  	headers: {Authorization: 'Bearer '+auth.getToken()}
	  }).success(function(data){
				comment.upvotes += 1;
		});
	};

return o;

}]);


app.controller('MainCtrl', [
'$scope',
'posts',
'auth',
'$http',
function($scope, posts, auth, $http){

	$scope.getImage = function() {
		return $http.get('/photo').success(function(res, status){
			$scope.image_url = res
		});
	};

	$scope.getQuote = function() {
		return $http.get('http://quotes.rest/qod.json?category=inspire').success(function(res){
				$scope.quote = res.contents.quotes[0].quote;
				$scope.quoteAuthor = res.contents.quotes[0].author;
			}).error(function(res){
				//fall back if request limit is reached
				$scope.quote = "Always work hard on something uncomfortably exciting";
				$scope.quoteAuthor = "Larry Page";
			});
	};

  $scope.posts = posts.posts;

  $scope.isLoggedIn = auth.isLoggedIn;

	$scope.addPost = function() {

		if(!$scope.title || $scope.title === '') {return;}

		posts.create({
		  title: $scope.title,
		  user: auth.currentUser()
		});

		$scope.title= '';

	};

	$scope.incrementUpvotes = function(post) {
	  posts.upvote(post);
	};

	$scope.deletePost = function(post) {
		$scope.posts.splice($scope.posts.indexOf(post), 1);

		posts.delete(post);
	};

}]);


app.controller('PostsCtrl', [
'$scope',
'posts',
'post',
'auth',
function($scope, posts, post, auth){

	$scope.post = post;

  $scope.isLoggedIn = auth.isLoggedIn;

	$scope.addComment = function(){
	  if($scope.body === '') { return; }
	  posts.addComment(post._id, {
	    body: $scope.body,
	    author: 'user',
	  }).success(function(comment) {
	  	$scope.post.comments.push(comment);
	  });
	  $scope.body = '';
	};

	$scope.incrementUpvotes = function(comment) {
		posts.upvoteComment(post, comment);
	};

}]);

app.controller('AuthCtrl', [
'$scope',
'$state',
'auth',
function($scope, $state, auth){
	$scope.user = {};

	$scope.register = function() {
		auth.register($scope.user).error(function(error){
			$scope.error = error;
		}).then(function(){
			$state.go('home');
		});
	};

	$scope.logIn = function(){
		auth.logIn($scope.user).error(function(error){
			$scope.error = error;
		}).then(function(){
			$state.go('home');
		});
	};

}]);

app.controller('NavCtrl', [
'$scope',
'auth',
function($scope, auth){
	$scope.isLoggedIn = auth.isLoggedIn;
	$scope.currentUser = auth.currentUser;
	$scope.logOut = auth.logOut;
}]);
