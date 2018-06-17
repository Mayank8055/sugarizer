// Rebase require directory
requirejs.config({
	baseUrl: "lib"
});

// Default library url
var defaultUrlLibrary = "./library.json";

// Vue main app
var app = new Vue({
	el: '#app',
	components: { 'ebook-reader': EbookReader, 'library-viewer': LibraryViewer, 'toolbar': Toolbar, 'localization': Localization, 'popup': Popup },
	data: {
		currentBook: null,
		currentEpub: null,
		currentView: LibraryViewer,
		currentLibrary: {database: []},
		timer: null
	},

	created: function() {
		require(["sugar-web/activity/activity", "sugar-web/env"], function(activity, env) {
			// Initialize Sugarizer
			activity.setup();
		});
	},

	mounted: function() {
		// Load last library from Journal
		var vm = this;
		require(["sugar-web/activity/activity", "sugar-web/env"], function(activity, env) {
			env.getEnvironment(function(err, environment) {
				if (environment.objectId) {
					activity.getDatastoreObject().loadAsText(function(error, metadata, data) {
						if (error==null && data!=null) {
							var parsed = JSON.parse(data);
							vm.currentLibrary = parsed.library;
							if (parsed.current !== undefined) {
								vm.currentBook = vm.currentLibrary.database[parsed.current];
								vm.currentEpub = ePub(vm.currentLibrary.information.fileprefix+vm.currentBook.file);
								vm.currentView = EbookReader;
							}
							document.getElementById("spinner").style.visibility = "hidden";
						}
					});
				} else {
					vm.loadLibrary(defaultUrlLibrary);
				}
			});
		});

		// Handle resize
		window.addEventListener("resize", function() {
			vm.onResize();
		});

		// Handle unfull screen buttons (b)
		document.getElementById("unfullscreen-button").addEventListener('click', function() {
			vm.unfullscreen();
		});
	},

	updated: function() {
		if (this.currentView === EbookReader) {
			this.$refs.view.render(this.currentEpub, this.currentBook.location);
		}
	},

	methods: {

		localized: function() {
			this.$refs.toolbar.localized(this.$refs.localization);
		},

		loadLibrary: function(url) {
			var vm = this;
			vm.currentLibrary = {database: []};
			defaultUrlLibrary = url;
			document.getElementById("spinner").style.visibility = "visible";
			axios.get(url)
				.then(function(response) {
					vm.currentLibrary = response.data;
					document.getElementById("spinner").style.visibility = "hidden";
					document.getElementById("cloudwarning").style.visibility = "hidden";
				})
				.catch(function(error) {
					document.getElementById("spinner").style.visibility = "hidden";
					document.getElementById("cloudwarning").style.visibility = "visible";
				});
		},

		saveContext: function() {
			if (this.currentView === EbookReader) {
				this.currentBook.location = this.$refs.view.getLocation();
			} else {
				this.currentLibrary = this.$refs.view.library;
			}
		},

		switchView: function() {
			this.saveContext();
			if (this.currentView === EbookReader) {
				this.currentView = LibraryViewer;
			} else {
				if (this.currentBook) {
					this.currentView = EbookReader;
				}
			}
		},

		// Handle fullscreen mode
		fullscreen: function() {
			document.getElementById("main-toolbar").style.opacity = 0;
			document.getElementById("canvas").style.top = "0px";
			document.getElementById("unfullscreen-button").style.visibility = "visible";
			if (this.currentView === EbookReader) {
				var reader = this.$refs.view;
				reader.render(this.currentEpub, reader.getLocation());
			}
		},
		unfullscreen: function() {
			document.getElementById("main-toolbar").style.opacity = 1;
			document.getElementById("canvas").style.top = "55px";
			document.getElementById("unfullscreen-button").style.visibility = "hidden";
			if (this.currentView === EbookReader) {
				var reader = this.$refs.view;
				reader.render(this.currentEpub, reader.getLocation());
			}
		},

		// Handling popup settings
		setLibraryUrl: function() {
			var titleOk = this.$refs.localization.get("Ok"),
				titleCancel = this.$refs.localization.get("Cancel"),
				titleSettings = this.$refs.localization.get("Settings"),
				titleUrl = this.$refs.localization.get("Url");
			this.$refs.settings.show({
				content: `
					<div id='popup-toolbar' class='toolbar' style='padding: 0'>
						<button class='toolbutton pull-right' id='popup-ok-button' title='`+titleOk+`' style='outline:none;background-image: url(lib/sugar-web/graphics/icons/actions/dialog-ok.svg)'></button>
						<button class='toolbutton pull-right' id='popup-cancel-button' title='`+titleCancel+`' style='outline:none;background-image: url(lib/sugar-web/graphics/icons/actions/dialog-cancel.svg)'></button>
						<div style='position: absolute; top: 20px; left: 60px;'>`+titleSettings+`</div>
					</div>
					<div id='popup-container' style='width: 100%; overflow:auto'>
						<div class='popup-label'>`+titleUrl+`</div>
						<input id='input' class='popup-input'/>
					</div>`,
				closeButton: false,
				modalStyles: {
					backgroundColor: "white",
					height: "160px",
					width: "600px",
					maxWidth: "90%"
				}
			});
		},
		settingsShown: function() {
			var vm = this;
			document.getElementById('popup-container').style.height = (document.getElementById("popup-toolbar").parentNode.offsetHeight - 55*2) + "px";
			document.getElementById('popup-ok-button').addEventListener('click', function() {
				vm.$refs.settings.close(true);
			});
			document.getElementById('popup-cancel-button').addEventListener('click', function() {
				vm.$refs.settings.close();
			});
			document.getElementById('input').value = defaultUrlLibrary;
		},
		settingsClosed: function(result) {
			if (result) {
				this.loadLibrary(document.getElementById('input').value);
			}
			this.$refs.settings.destroy();
		},

		// Handle events
		onBookSelected: function(book) {
			if (this.currentView === LibraryViewer) {
				// Load book
				var vm = this;
				vm.currentBook = book;
				vm.currentEpub = new ePub.Book();
				vm.currentEpub.open(vm.currentLibrary.information.fileprefix+vm.currentBook.file).then(function() {
					vm.currentView = EbookReader;
				}, function() {
				});
			}
		},

		onResize: function() {
			var vm = this;
			if (vm.currentView === EbookReader) {
				var reader = vm.$refs.view;
				if (this.timer) {
					window.clearTimeout(this.timer);
				}
				this.timer = window.setTimeout(function() {
					vm.currentBook.location = reader.getLocation();
					reader.render(vm.currentEpub, vm.currentBook.location);
					this.timer = null;
				}, 500);
			}
		},

		onStop: function() {
			// Save current library in Journal on Stop
			var vm = this;
			vm.saveContext();
			require(["sugar-web/activity/activity"], function(activity) {
				console.log("writing...");
				var context = {
					library: { information:vm.currentLibrary.information, database:vm.currentLibrary.database }
				};
				if (vm.currentView === EbookReader) {
					context.current = vm.currentLibrary.database.indexOf(vm.currentBook);
				}
				var jsonData = JSON.stringify(context);
				activity.getDatastoreObject().setDataAsText(jsonData);
				activity.getDatastoreObject().save(function(error) {
					if (error === null) {
						console.log("write done.");
					} else {
						console.log("write failed.");
					}
				});
			});
		}
	}
});
