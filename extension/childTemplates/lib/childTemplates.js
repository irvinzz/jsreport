﻿/*! 
 * Copyright(c) 2014 Jan Blaha 
 * 
 * ChildTemplates extensions hooks before rendering process and expands every child template specification.
 */ 

var winston = require("winston"),
    Q = require("q"),
    asyncReplace = require("async-replace"),
    extend = require("node.extend");

var logger = winston.loggers.get('jsreport');

module.exports = function(reporter, definition) {
    reporter[definition.name] = new ChildTemplates(reporter, definition);
};

ChildTemplates = function(reporter, definition) {
    this.reporter = reporter;
    this.definition = definition;

    reporter.beforeRenderListeners.add(definition.name, this, ChildTemplates.prototype.handleBeforeRender);
};

ChildTemplates.prototype.handleBeforeRender = function(request, response) {
    var self = this;
    
    var isRootRequest = false;
    if (request.childs == null) {
        request.childs = {};
        isRootRequest = true;
    }

    request.childs.childsCircleCache = request.childs.childsCircleCache || {};

    function convert(str, p1, offset, s, done) {
        if (request.childs.childsCircleCache[p1] != null && !isRootRequest) {
            return done(null, "circle in using child template " + p1);
        }

        request.childs.childsCircleCache[p1] = true;

        request.context.templates.filter(function(t) { return t.name == this.name; }, { name: p1 }).toArray().then(function(res) {
            if (res.length < 1)
                return done(null);

            var req = extend(true, {}, request);

            if (!isRootRequest)
                req.childs.childsCircleCache = request.childs.childsCircleCache;

            req.template = res[0];
            self.reporter.render(req).then(function(resp) {
                done(null, resp.result);
            });
        });
    }

    var test = /{#child ([^{}]+)+}/g;

    return Q.nfcall(asyncReplace, request.template.content, test, convert).then(function(result) {
        request.template.content = result;
    });
};