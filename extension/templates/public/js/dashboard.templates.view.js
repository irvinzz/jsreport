﻿/*! 
 * Copyright(c) 2014 Jan Blaha 
 */ 

define(["marionette", "jquery"], function(Marionette, $) {

    return Backbone.Marionette.ItemView.extend({
        template: "dashboard-templates",

        events: {
            "click tr": "showDetail",
        },

        initialize: function () {
            this.listenTo(this.collection, "sync", this.render);
        },

        showDetail: function (ev, data) {
            var id = $(ev.target).closest("tr").attr("data-id");
            window.location.hash = "extension/templates/" + id;
        }
    });
    
});

