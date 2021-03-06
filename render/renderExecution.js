﻿/*! 
 * Copyright(c) 2014 Jan Blaha 
 *
 * Child process rendering html(xml) from template content, helpers and input data.
 */ 

process.on('message', function(m) {
    try {

        //resolve references in json specified by $ref and $id attribute, this is handy when user send cycles in json
        var resolveReferences = function(json) {
            if (typeof json === 'string')
                json = JSON.parse(json);

            var byid = {}, // all objects by id
                refs = []; // references to objects that could not be resolved
            json = (function recurse(obj, prop, parent) {
                if (typeof obj !== 'object' || !obj) // a primitive value
                    return obj;
                if (Object.prototype.toString.call(obj) === '[object Array]') {
                    for (var i = 0; i < obj.length; i++)
                        if ("$ref" in obj[i])
                            obj[i] = recurse(obj[i], i, obj);
                        else
                            obj[i] = recurse(obj[i], prop, obj);
                    return obj;
                }
                if ("$ref" in obj) { // a reference
                    var ref = obj.$ref;
                    if (ref in byid)
                        return byid[ref];
                    // else we have to make it lazy:
                    refs.push([parent, prop, ref]);
                    return;
                } else if ("$id" in obj) {
                    var id = obj.$id;
                    delete obj.$id;
                    if ("$values" in obj) // an array
                        obj = obj.$values.map(recurse);
                    else // a plain object
                        for (var prop in obj)
                            obj[prop] = recurse(obj[prop], prop, obj);
                    byid[id] = obj;
                }
                return obj;
            })(json); // run it!

            for (var i = 0; i < refs.length; i++) { // resolve previously unknown references
                var ref = refs[i];
                ref[0][ref[1]] = byid[ref[2]];
                // Notice that this throws if you put in a reference at top-level
            }
            return json;
        };

        m.data = resolveReferences(m.data);


        var _require = function(moduleName) {
            var allowedModules = ["handlebars", "moment"];

            if (allowedModules.filter(function(mod) { return mod == moduleName; }).length == 1) {

                return require(moduleName);
            }

            throw new Error("Unsupported module " + moduleName);
        };

        var vm = require('vm');
        var sandbox = {
            _: require("underscore"),
            moment: require("moment"),
            m: m,
            handlebars: require("handlebars"),
            require: _require,
            render: require("./" + m.template.engine + "Engine" + ".js"),
            respond: function(content) {
                process.send({
                    content: content
                });
            }
        };

        if (m.template.helpers != null && m.template.helpers != "") {
            
            //first grab helpers as it would be an object { "foo" : function... } for back compatibility reasons
            //when its not an object eval again and let helpers register into globals
            
            vm.runInNewContext("jsrHelpers = " + m.template.helpers, sandbox);

            if (sandbox["jsrHelpers"] != null && typeof sandbox["jsrHelpers"] === 'object') {
                m.template.helpers = sandbox["jsrHelpers"];
            } else {
                
                vm.runInNewContext(m.template.helpers, sandbox);

                m.template.helpers = {};
                for (var fn in sandbox) {
                    if (typeof sandbox[fn] == "function") {
                        m.template.helpers[fn] = sandbox[fn];
                    }
                }
            }
        } else
            m.template.helpers = {};

        vm.runInNewContext("respond(render(m.template.content, m.template.helpers, m.data))", sandbox);
    } catch(ex) {
        process.send({
            error: ex.message,
            errorStack: ex.stack
        });
    }

    process.exit();
});