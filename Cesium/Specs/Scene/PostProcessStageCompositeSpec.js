defineSuite([
        'Scene/PostProcessStageComposite',
        'Core/Color',
        'Core/defined',
        'Scene/PostProcessStage',
        'Specs/createScene',
        'Specs/pollToPromise',
        'ThirdParty/when'
    ], function(
        PostProcessStageComposite,
        Color,
        defined,
        PostProcessStage,
        createScene,
        pollToPromise,
        when) {
    'use strict';

    var scene;

    beforeAll(function() {
        scene = createScene();
        scene.postProcessStages.fxaa.enabled = false;
    });

    afterAll(function() {
        scene.destroyForSpecs();
    });

    afterEach(function() {
        scene.postProcessStages.removeAll();
    });

    it('constructs', function() {
        var stage = new PostProcessStage({
            fragmentShader : 'uniform vec4 color; void main() { gl_FragColor = color; }',
            uniforms : {color : Color.clone(Color.RED)}
        });
        var uniforms = {
            color : {
                get : function() {
                    return stage.uniforms.color;
                },
                set : function(value) {
                    stage.uniforms.color = value;
                }
            }
        };
        var inputPreviousStageTexture = false;
        var name = 'kaleidoscope';

        var composite = new PostProcessStageComposite({
            stages : [stage],
            uniforms : uniforms,
            inputPreviousStageTexture : inputPreviousStageTexture,
            name : name
        });
        expect(composite.ready).toEqual(false);
        expect(composite.name).toEqual(name);
        expect(composite.enabled).toEqual(true);
        expect(composite.uniforms).toEqual(uniforms);
        expect(composite.inputPreviousStageTexture).toEqual(inputPreviousStageTexture);
        expect(composite.length).toEqual(1);
    });

    it('default constructs', function() {
        var stage1 = new PostProcessStage({
            fragmentShader : 'void main() { gl_FragColor = vec4(1.0); }'
        });
        var stage2 = new PostProcessStage({
            fragmentShader : 'void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }'
        });
        var composite = new PostProcessStageComposite({
            stages : [stage1, stage2]
        });
        expect(composite.ready).toEqual(false);
        expect(composite.name).toBeDefined();
        expect(composite.enabled).toEqual(true);
        expect(composite.uniforms).not.toBeDefined();
        expect(composite.inputPreviousStageTexture).toEqual(true);
        expect(composite.length).toEqual(2);
    });

    it('throws without stages', function() {
        expect(function() {
            return new PostProcessStageComposite();
        }).toThrowDeveloperError();
        expect(function() {
            return new PostProcessStageComposite({ stages : [] });
        }).toThrowDeveloperError();
    });

    it('gets stages', function() {
        var stage1 = new PostProcessStage({
            fragmentShader : 'void main() { gl_FragColor = vec4(1.0); }'
        });
        var stage2 = new PostProcessStage({
            fragmentShader : 'void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }'
        });
        var composite = new PostProcessStageComposite({
            stages : [stage1, stage2]
        });
        expect(composite.get(0)).toEqual(stage1);
        expect(composite.get(1)).toEqual(stage2);
    });

    it('throws when get index is invalid', function() {
        var stage1 = new PostProcessStage({
            fragmentShader : 'void main() { gl_FragColor = vec4(1.0); }'
        });
        var stage2 = new PostProcessStage({
            fragmentShader : 'void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }'
        });
        var composite = new PostProcessStageComposite({
            stages : [stage1, stage2]
        });
        expect(function() {
            return composite.get(-1);
        }).toThrowDeveloperError();
        expect(function() {
            return composite.get(composite.length + 1);
        }).toThrowDeveloperError();
    });

    it('renders with inputPreviousStageTexture is true', function() {
        var stage1 = new PostProcessStage({
            fragmentShader : 'void main() { gl_FragColor = vec4(1.0); }'
        });
        var stage2 = new PostProcessStage({
            fragmentShader : 'uniform sampler2D colorTexture;\n' +
                             'varying vec2 v_textureCoordinates;\n' +
                             'void main() {\n' +
                             '    vec4 color = texture2D(colorTexture, v_textureCoordinates);\n' +
                             '    gl_FragColor = vec4(color.r, 0.0, 1.0, 1.0);\n' +
                             '}'
        });
        var composite = new PostProcessStageComposite({
            stages : [stage1, stage2]
        });

        expect(scene).toRender([0, 0, 0, 255]);
        scene.postProcessStages.add(composite);
        scene.renderForSpecs(); // update to ready;
        expect(scene).toRender([255, 0, 255, 255]);
    });

    it('renders with inputPreviousStageTexture is false', function() {
        var stage1 = new PostProcessStage({
            fragmentShader : 'void main() { gl_FragColor = vec4(1.0); }'
        });
        var stage2 = new PostProcessStage({
            fragmentShader : 'uniform sampler2D colorTexture;\n' +
                             'varying vec2 v_textureCoordinates;\n' +
                             'void main() {\n' +
                             '    vec4 color = texture2D(colorTexture, v_textureCoordinates);\n' +
                             '    gl_FragColor = vec4(color.r, 0.0, 1.0, 1.0);\n' +
                             '}'
        });
        var composite = new PostProcessStageComposite({
            stages : [stage1, stage2],
            inputPreviousStageTexture : false
        });

        expect(scene).toRender([0, 0, 0, 255]);
        scene.postProcessStages.add(composite);
        scene.renderForSpecs(); // update to ready;
        expect(scene).toRender([0, 0, 255, 255]);
    });

    it('isSupported throws without a scene', function() {
        var stage = new PostProcessStageComposite({
            stages : [new PostProcessStage({
                fragmentShader : 'void main() { gl_FragColor = vec4(1.0); }'
            })]
        });
        expect(function() {
            return stage.isSupported();
        }).toThrowDeveloperError();
    });

    it('isSupported', function() {
        var stage = new PostProcessStageComposite({
            stages : [new PostProcessStage({
                fragmentShader : 'void main() { gl_FragColor = vec4(1.0); }'
            })]
        });
        expect(stage.isSupported(scene)).toEqual(true);
        stage = new PostProcessStageComposite({
            stages : [new PostProcessStage({
                fragmentShader : 'uniform sampler2D depthTexture; void main() { texture2D(depthTexture, vec2(0.5)); }'
            })]
        });
        expect(stage.isSupported(scene)).toEqual(scene.context.depthTexture);
    });

    it('does not run a stage that requires depth textures when depth textures are not supported', function() {
        var s = createScene();
        s.context._depthTexture = false;

        if (defined(s._globeDepth)) {
            s._globeDepth.destroy();
            s._globeDepth = undefined;
            if (defined(s._oit)) {
                s._oit.destroy();
                s._oit = undefined;
            }
        }

        expect(s).toRender([0, 0, 0, 255]);
        var stage = s.postProcessStages.add(new PostProcessStageComposite({
            stages : [new PostProcessStage({
                fragmentShader : 'uniform sampler2D depthTexture; void main() { gl_FragColor = vec4(1.0); }'
            })]
        }));
        return pollToPromise(function() {
            s.renderForSpecs();
            return stage.ready;
        }).then(function() {
            expect(s).toRender([0, 0, 0, 255]);
        }).always(function(e) {
            s.destroyForSpecs();
            if (e) {
                return when.reject(e);
            }
        });
    });

    it('destroys', function() {
        var stage1 = new PostProcessStage({
            fragmentShader : 'void main() { gl_FragColor = vec4(1.0); }'
        });
        var stage2 = new PostProcessStage({
            fragmentShader : 'void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }'
        });
        var composite = new PostProcessStageComposite({
            stages : [stage1, stage2]
        });
        expect(stage1.isDestroyed()).toEqual(false);
        expect(stage2.isDestroyed()).toEqual(false);
        expect(composite.isDestroyed()).toEqual(false);
        composite.destroy();
        expect(composite.isDestroyed()).toEqual(true);
        expect(stage1.isDestroyed()).toEqual(true);
        expect(stage2.isDestroyed()).toEqual(true);
    });

}, 'WebGL');
