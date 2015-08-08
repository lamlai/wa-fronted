//@prepros-prepend 'modernizr.custom.js'
//@prepros-prepend '../bower_components/medium-editor/dist/js/medium-editor.min.js'
//@prepros-prepend 'eventmanager.js'
//@prepros-prepend 'medium-wa-image-upload.js'

function escape_regexp(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};

var wa_fronted;

(function($){

	wa_fronted = {

		options: $.parseJSON(global_vars.options),

		/**
		 * Contains running auto save timers and editable areas
		 * @type {Object}
		 */
		data: {
			editable_areas         : [],
			timers                 : {},
			current_selection      : false,
			current_range          : false,
			current_editor_options : false,
			has_changes            : false
		},

		/*
		*  This function uses wp.hooks to mimics WP add_action
		*
		*  @param	
		*  @return
		*/
		add_action: function() {
			
			// allow multiple action parameters such as 'ready append'
			var actions = arguments[0].split(' ');
			
			for( k in actions ) {
			
				// prefix action
				arguments[0] = 'wa_fronted.' + actions[ k ];
				
				wp.hooks.addAction.apply(this, arguments);
			}
			
			return this;
			
		},
		
		/*
		*  This function uses wp.hooks to mimics WP remove_action
		*
		*  @param	
		*  @return
		*/
		remove_action: function() {
			
			// prefix action
			arguments[0] = 'wa_fronted.' + arguments[0];
			
			wp.hooks.removeAction.apply(this, arguments);
			
			return this;
			
		},
		
		/*
		*  This function uses wp.hooks to mimics WP do_action
		*
		*  @param	
		*  @return
		*/
		do_action: function() {
			
			// prefix action
			arguments[0] = 'wa_fronted.' + arguments[0];
			
			wp.hooks.doAction.apply(this, arguments);
			
			return this;
			
		},
		
		/*
		*  This function uses wp.hooks to mimics WP add_filter
		*
		*  @param	
		*  @return
		*/
		add_filter: function() {
			
			// prefix action
			arguments[0] = 'wa_fronted.' + arguments[0];
			
			wp.hooks.addFilter.apply(this, arguments);
			
			return this;
			
		},
		
		/*
		*  This function uses wp.hooks to mimics WP remove_filter
		*
		*  @param	
		*  @return
		*/
		remove_filter: function() {
			
			// prefix action
			arguments[0] = 'wa_fronted.' + arguments[0];
			
			wp.hooks.removeFilter.apply(this, arguments);
			
			return this;
			
		},
		
		/*
		*  This function uses wp.hooks to mimics WP apply_filters
		*
		*  @param	
		*  @return
		*/
		apply_filters: function() {
			
			// prefix action
			arguments[0] = 'wa_fronted.' + arguments[0];
			
			return wp.hooks.applyFilters.apply(this, arguments);
			
		},

		/**
		 * Loop through all editable areas and setup editor for each
		 */
		initialize: function(){
			var self = this;

			if(typeof self.options.editable_areas !== undefined && self.options.editable_areas.length !== 0){
				for(var i = 0; i < self.options.editable_areas.length; i++){
					
					var editors = $(self.options.editable_areas[i].container);

					if(editors.length !== 0){
						$.each(editors, function(index, el){
							el = $(el);
							el.addClass('wa-fronted-editor');
							self.setup_editor(el, self.options.editable_areas[i], self.options);
							self.data.editable_areas.push({
								editor  : el,
								options : self.options.editable_areas[i]
							});
						});
					}
				}

				self.do_action('on_init');
				self.bind();
			}
		},

		/**
		 * Do global event bindings
		 */
		bind: function(){
			var self = this;

			$('#wa-fronted-save').click(function(){
				self.save();
			});

			$('#wa-fronted-settings').click(function(){
				$('#wa-fronted-settings-modal').fadeIn('fast');
			});

			$('.close-wa-fronted-modal').click(function(){
				$('#wa-fronted-settings-modal').fadeOut('fast');
			});

			var wa_datepicker = $('.wa_fronted_datepicker');
			wa_datepicker.datetimepicker({
				dateFormat : 'yy-mm-dd',
				timeFormat : 'HH:mm:ss'
			});
			wa_datepicker.datetimepicker('setDate', wa_datepicker.val());

			$('#wa-fronted-settings-modal select').selectmenu();

			self.do_action('on_bind');

			window.onbeforeunload = function(){
				if(self.data.has_changes){
			  		return 'The changes you have made will be lost if you navigate away from this page.';
				}
			};
		},

		/**
		 * Sets up editor instance with specific options for field
		 * @param  {jQuery Object} element to attach editor to
		 * @param  {Object} specific options for this field
		 * @param  {Object} all options for all fields
		 */
		setup_editor: function(this_editor, this_options, all_options){

			var self = this,
				editor_options = {
				    buttons: [
				    	'bold', 
				    	'italic', 
				    	'underline', 
				    	'anchor', 
				    	'header1', 
				    	'header2', 
				    	'quote', 
				    	'unorderedlist', 
				    	'orderedlist', 
				    	'justifyLeft', 
				    	'justifyCenter', 
				    	'justifyRight'
				    ],
				    buttonLabels: 'fontawesome',
				    imageDragging: false,
				    autoLink: true,
				    anchorPreview: false,
				    anchor: {
				    	linkValidation: true
				    }
				};

			if(this_options.toolbar === undefined){
				this_options.toolbar = 'full';
			}

			if(this_options.toolbar === 'false' || this_options.toolbar === false){
				editor_options.toolbar = false;
			}else if(this_options.toolbar !== 'full'){
				editor_options.buttons = (this_options.toolbar.replace(/\s+/g, '')).split(',');
			}

			editor_options.buttons = self.apply_filters('toolbar_buttons', editor_options.buttons, this_options);

			this_editor.click(function(){
				var sel = window.getSelection();
				if(sel){
			        self.data.current_selection = $.extend({}, sel);
			        if(sel.rangeCount){
			        	self.data.current_range = sel.getRangeAt(0);
					}
				}
			});

			var editor = false;

			if(this_options.media_upload !== 'only' && this_options.native){

				if(this_options.media_upload === true){
					editor_options.extensions = {
				    	'image_upload' : new Wa_image_upload(this_options)
				    }

				}
				
				editor_options.extensions = self.apply_filters('medium_extensions', editor_options.extensions, this_options);

				editor = new MediumEditor(this_editor, editor_options);

				//Hook onto paste event and determine if pasted content is valid oEmbed
				editor.subscribe('editablePaste', function (event, editable) {
					event.preventDefault();
					var clipboardData = event.clipboardData.getData('text/plain');
					if(clipboardData && (clipboardData.indexOf('http://') !== -1 || clipboardData.indexOf('https://') !== -1)){
						self.show_loading_spinner();
						$.post(
							global_vars.ajax_url,
							{
								'action' : 'wa_get_oembed',
								'link'	 : clipboardData
							}, 
							function(response){
								if(response.oembed !== false){
									var current_content = this_editor.html(),
										regex_str	= escape_regexp(clipboardData),
										regex       = new RegExp(regex_str, 'm'),
										new_content = current_content.replace(regex, response.oembed);
									this_editor.html(new_content);
								}
								self.hide_loading_spinner();
							}
						);
					}
				});

			}else if(this_options.media_upload === 'only' && this_options.native){
				editor_options.toolbar    = false;
				editor_options.spellcheck = false;
				editor_options.extensions = {
			    	'image_upload' : new Wa_image_upload(this_options)
			    }

				editor_options.extensions = self.apply_filters('medium_extensions', editor_options.extensions, this_options);

				editor = new MediumEditor(this_editor, editor_options);
			}else{
				self.do_action('on_setup_editor', this_editor, this_options, all_options);
			}


			//If editor exists
			if(editor !== false){
				//Register changes to the editor and show savebutton
				editor.subscribe('editableInput', function (event, editable) {
					clearTimeout(self.data.timers[editor.id]);
					self.data.timers[editor.id] = setTimeout(function(){
						self.data.has_changes = true;
						self.auto_save(this_editor, this_options);
						self.show_save_button();
					}, 1000);
				});
			}
		},

		/**
		 * Trigger custom Medium-Editor event
		 * @param  {string} event name of custom event
		 */
		trigger: function(instance, event){
			instance.events.customEvents[event][0]();
		},

		/**
		 * Auto save post
		 * @param  {jQuery Object} editor element of what to save
		 * @param  {Object} options for this editor
		 * @todo: auto save post
		 */
		auto_save: function(editor_container, options){
			console.log('auto save', editor_container, options);
		},

		/**
		 * Save post
		 */
		save: function(){
			var self = this,
				editors = self.data.editable_areas,
				save_this = [];

			self.show_loading_spinner();

			for(var i = 0; i < editors.length; i++){

				var db_value = editors[i].editor.attr('data-db-value'),
					content = '';

				if(typeof db_value !== typeof undefined && db_value !== false){
					content = db_value;
				}else{
					content = editors[i].editor.html();
				}

				save_this.push({
					'content' : content,
					'options' : editors[i].options
				});
			}

			$.post(
				global_vars.ajax_url,
				{
					'action'                : 'wa_fronted_save',
					'data'                  : save_this,
					'wa_fronted_save_nonce' : self.options.nonce
				}, 
				function(response){
					if(response.success){
						location.reload();
					}
					self.hide_loading_spinner();
				}
			);
		},

		show_save_button: function(){
			$('#wa-fronted-save').fadeIn('fast');
		},

		show_loading_spinner: function(){
			$('#wa-fronted-spinner').fadeIn('fast');
		},
		
		hide_loading_spinner: function(){
			$('#wa-fronted-spinner').fadeOut('fast');
		},

		/**
		 * Decodes shortcode from [data-shortcode] attribute on target element
		 * @param  {Object} element jQuery object
		 * @return {string}         shortcode
		 */
		shortcode_from_attr: function(element){
			return decodeURIComponent(element.attr('data-shortcode'));
		},

		/**
		 * Takes a shortcode and returns rendered html from it
		 * @param  {string}   shortcode A valid WordPress shortcode
		 * @param  {Function} callback  Callback function, sends html as parameter
		 */
		shortcode_to_html: function(shortcode, comments, callback){
			$.post(
	            global_vars.ajax_url,
	            {
					'action'    : 'wa_render_shortcode',
					'shortcode' : shortcode,
					'comments'  : comments
	            }, 
	            function(response){
	                callback(response);
	            }
	        );
		},

		/**
		 * Get position of caret in pixels
		 * @return {Object} pixel position in X and Y
		 */
		getCaretPositionPx: function() {
		    var x = 0, y = 0;
		    var sel = window.getSelection();
		    if (sel.rangeCount) {

		        var range = sel.getRangeAt(0);
		        var needsToWorkAroundNewlineBug = (range.startContainer.nodeName.toLowerCase() == 'p'
		                                           && range.startOffset == 0);

		        if (needsToWorkAroundNewlineBug) {
		            x = range.startContainer.offsetLeft;
		            y = range.startContainer.offsetTop;
		        } else {
		            if (range.getClientRects) {
		                var rects = range.getClientRects();
		                if (rects.length > 0) {
		                    x = rects[0].left;
		                    y = rects[0].top;
		                }
		            }
		        }
		    }
		    return { x: x, y: y };
		},

		/**
		 * Get currently selected text
		 * @return {string}
		 */
		getSelectionText: function(){
		    var text = "";
		    if (window.getSelection) {
		        text = window.getSelection().toString();
		    } else if (document.selection && document.selection.type != "Control") {
		        text = document.selection.createRange().text;
		    }
		    return text;
		},

		/**
		 * Output to specific element or attribute
		 * @todo read output options
		 */
		specific_output_to: function(this_editor, this_options, db_value, output_content){
			if(!this_options.hasOwnProperty('output_to') || !this_options.output_to.hasOwnProperty('selector')){
				return false;
			}

			var selector = $(this_editor).find(this_options.output_to.selector);
			if(selector.length === 0){
				return false;
			}

			if(this_options.output_to.hasOwnProperty('attr')){
				selector.attr(this_options.output_to.attr, output_content);
			}else{
				selector.html(output_content);
			}

			this_editor.attr('data-db-value', db_value);

			return true;
		},

		/**
		 * Insert html at current caret position
		 * Curtesy of https://github.com/jillix/medium-editor-custom-html/
		 * @param {string} html
		 */
		insertHtmlAtCaret: function(html) {
		    var self = this,
		    	sel, 
		    	range;
		    if (window.getSelection) {
		        // IE9 and non-IE
		        if(typeof self.data.current_selection === undefined || typeof self.data.current_selection === 'undefined' || self.data.current_selection === false){
		            sel = window.getSelection();
		            range = sel.getRangeAt(0);
		        }else{
		            sel = self.data.current_selection;
		            range = self.data.current_range;
		        }

		        if(typeof range !== 'undefined' && range !== false){
		        	range.deleteContents();
		        }

		        // Range.createContextualFragment() would be useful here but is
		        // only relatively recently standardized and is not supported in
		        // some browsers (IE9, for one)
		        var el = document.createElement("div");
		        el.innerHTML = html;
		        var frag = document.createDocumentFragment(), node, lastNode;
		        while ((node = el.firstChild)) {
		            lastNode = frag.appendChild(node);
		        }
		        range.insertNode(frag);

		        self.current_selection = false;
		    } else if (document.selection && document.selection.type != "Control") {
		        // IE < 9
		        document.selection.createRange().pasteHTML(html);
		    }
		},

		/**
		 * Replaces selector or jQuery object with new content
		 * @param  {mixed} element a selector or jQuery object of element to replace
		 */
		replace_html: function(element, new_content){
			el = $(element);
			el.replaceWith(new_content);
		}

	};


	$(document).ready(function(){
		if((typeof global_vars.options !== 'undefined') && Modernizr.contenteditable){

			window.wp = window.wp || {};
			if(typeof window.wp.hooks === 'undefined'){
				window.wp.hooks = new EventManager();
			}

			wa_fronted.initialize();
		}
	});

})(jQuery);