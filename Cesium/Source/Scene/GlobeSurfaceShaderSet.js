define([
        '../Core/defined',
        '../Core/destroyObject',
        '../Core/TerrainQuantization',
        '../Renderer/ShaderProgram',
        './getClippingFunction',
        './SceneMode'
    ], function(
        defined,
        destroyObject,
        TerrainQuantization,
        ShaderProgram,
        getClippingFunction,
        SceneMode) {
    'use strict';

    function GlobeSurfaceShader(numberOfDayTextures, flags, material, shaderProgram, clippingShaderState) {
        this.numberOfDayTextures = numberOfDayTextures;
        this.flags = flags;
        this.material = material;
        this.shaderProgram = shaderProgram;
        this.clippingShaderState = clippingShaderState;
    }

    /**
     * Manages the shaders used to shade the surface of a {@link Globe}.
     *
     * @alias GlobeSurfaceShaderSet
     * @private
     */
    function GlobeSurfaceShaderSet() {
        this.baseVertexShaderSource = undefined;
        this.baseFragmentShaderSource = undefined;

        this._shadersByTexturesFlags = [];
        this._pickShaderPrograms = [];

        this.material = undefined;
    }

    function getPositionMode(sceneMode) {
        var getPosition3DMode = 'vec4 getPosition(vec3 position, float height, vec2 textureCoordinates) { return getPosition3DMode(position, height, textureCoordinates); }';
        var getPositionColumbusViewAnd2DMode = 'vec4 getPosition(vec3 position, float height, vec2 textureCoordinates) { return getPositionColumbusViewMode(position, height, textureCoordinates); }';
        var getPositionMorphingMode = 'vec4 getPosition(vec3 position, float height, vec2 textureCoordinates) { return getPositionMorphingMode(position, height, textureCoordinates); }';

        var positionMode;

        switch (sceneMode) {
        case SceneMode.SCENE3D:
            positionMode = getPosition3DMode;
            break;
        case SceneMode.SCENE2D:
        case SceneMode.COLUMBUS_VIEW:
            positionMode = getPositionColumbusViewAnd2DMode;
            break;
        case SceneMode.MORPHING:
            positionMode = getPositionMorphingMode;
            break;
        }

        return positionMode;
    }

    function get2DYPositionFraction(useWebMercatorProjection) {
        var get2DYPositionFractionGeographicProjection = 'float get2DYPositionFraction(vec2 textureCoordinates) { return get2DGeographicYPositionFraction(textureCoordinates); }';
        var get2DYPositionFractionMercatorProjection = 'float get2DYPositionFraction(vec2 textureCoordinates) { return get2DMercatorYPositionFraction(textureCoordinates); }';
        return useWebMercatorProjection ? get2DYPositionFractionMercatorProjection : get2DYPositionFractionGeographicProjection;
    }

    GlobeSurfaceShaderSet.prototype.getShaderProgram = function(frameState, surfaceTile, numberOfDayTextures, applyBrightness, applyContrast, applyHue, applySaturation, applyGamma, applyAlpha, applySplit, showReflectiveOcean, showOceanWaves, enableLighting, hasVertexNormals, useWebMercatorProjection, enableFog, enableClippingPlanes, clippingPlanes) {
        var quantization = 0;
        var quantizationDefine = '';

        var terrainEncoding = surfaceTile.pickTerrain.mesh.encoding;
        var quantizationMode = terrainEncoding.quantization;
        if (quantizationMode === TerrainQuantization.BITS12) {
            quantization = 1;
            quantizationDefine = 'QUANTIZATION_BITS12';
        }

        var sceneMode = frameState.mode;
        var flags = sceneMode |
                    (applyBrightness << 2) |
                    (applyContrast << 3) |
                    (applyHue << 4) |
                    (applySaturation << 5) |
                    (applyGamma << 6) |
                    (applyAlpha << 7) |
                    (showReflectiveOcean << 8) |
                    (showOceanWaves << 9) |
                    (enableLighting << 10) |
                    (hasVertexNormals << 11) |
                    (useWebMercatorProjection << 12) |
                    (enableFog << 13) |
                    (quantization << 14) |
                    (applySplit << 15) |
                    (enableClippingPlanes << 16);

        var currentClippingShaderState = 0;
        if (defined(clippingPlanes)) {
            currentClippingShaderState = enableClippingPlanes ? clippingPlanes.clippingPlanesState : 0;
        }
        var surfaceShader = surfaceTile.surfaceShader;
        if (defined(surfaceShader) &&
            surfaceShader.numberOfDayTextures === numberOfDayTextures &&
            surfaceShader.flags === flags &&
            surfaceShader.material === this.material &&
            surfaceShader.clippingShaderState === currentClippingShaderState) {

            return surfaceShader.shaderProgram;
        }

        // New tile, or tile changed number of textures, flags, or clipping planes
        var shadersByFlags = this._shadersByTexturesFlags[numberOfDayTextures];
        if (!defined(shadersByFlags)) {
            shadersByFlags = this._shadersByTexturesFlags[numberOfDayTextures] = [];
        }

        surfaceShader = shadersByFlags[flags];
        if (!defined(surfaceShader) || surfaceShader.material !== this.material || surfaceShader.clippingShaderState !== currentClippingShaderState) {
            // Cache miss - we've never seen this combination of numberOfDayTextures and flags before.
            var vs = this.baseVertexShaderSource.clone();
            var fs = this.baseFragmentShaderSource.clone();

            if (currentClippingShaderState !== 0) {
                fs.sources.unshift(getClippingFunction(clippingPlanes, frameState.context)); // Need to go before GlobeFS
            }

            vs.defines.push(quantizationDefine);
            fs.defines.push('TEXTURE_UNITS ' + numberOfDayTextures);

            if (applyBrightness) {
                fs.defines.push('APPLY_BRIGHTNESS');
            }
            if (applyContrast) {
                fs.defines.push('APPLY_CONTRAST');
            }
            if (applyHue) {
                fs.defines.push('APPLY_HUE');
            }
            if (applySaturation) {
                fs.defines.push('APPLY_SATURATION');
            }
            if (applyGamma) {
                fs.defines.push('APPLY_GAMMA');
            }
            if (applyAlpha) {
                fs.defines.push('APPLY_ALPHA');
            }
            if (showReflectiveOcean) {
                fs.defines.push('SHOW_REFLECTIVE_OCEAN');
                vs.defines.push('SHOW_REFLECTIVE_OCEAN');
            }
            if (showOceanWaves) {
                fs.defines.push('SHOW_OCEAN_WAVES');
            }

            if (enableLighting) {
                if (hasVertexNormals) {
                    vs.defines.push('ENABLE_VERTEX_LIGHTING');
                    fs.defines.push('ENABLE_VERTEX_LIGHTING');
                } else {
                    vs.defines.push('ENABLE_DAYNIGHT_SHADING');
                    fs.defines.push('ENABLE_DAYNIGHT_SHADING');
                }
            }

            vs.defines.push('INCLUDE_WEB_MERCATOR_Y');
            fs.defines.push('INCLUDE_WEB_MERCATOR_Y');

            if (enableFog) {
                vs.defines.push('FOG');
                fs.defines.push('FOG');
            }

            if (applySplit) {
                fs.defines.push('APPLY_SPLIT');
            }

            if (enableClippingPlanes) {
                fs.defines.push('ENABLE_CLIPPING_PLANES');
            }

            var computeDayColor = '\
    vec4 computeDayColor(vec4 initialColor, vec3 textureCoordinates)\n\
    {\n\
        vec4 color = initialColor;\n';

            for (var i = 0; i < numberOfDayTextures; ++i) {
                computeDayColor += '\
    color = sampleAndBlend(\n\
        color,\n\
        u_dayTextures[' + i + '],\n\
        u_dayTextureUseWebMercatorT[' + i + '] ? textureCoordinates.xz : textureCoordinates.xy,\n\
        u_dayTextureTexCoordsRectangle[' + i + '],\n\
        u_dayTextureTranslationAndScale[' + i + '],\n\
        ' + (applyAlpha ? 'u_dayTextureAlpha[' + i + ']' : '1.0') + ',\n\
        ' + (applyBrightness ? 'u_dayTextureBrightness[' + i + ']' : '0.0') + ',\n\
        ' + (applyContrast ? 'u_dayTextureContrast[' + i + ']' : '0.0') + ',\n\
        ' + (applyHue ? 'u_dayTextureHue[' + i + ']' : '0.0') + ',\n\
        ' + (applySaturation ? 'u_dayTextureSaturation[' + i + ']' : '0.0') + ',\n\
        ' + (applyGamma ? 'u_dayTextureOneOverGamma[' + i + ']' : '0.0') + ',\n\
        ' + (applySplit ? 'u_dayTextureSplit[' + i + ']' : '0.0') + '\n\
    );\n';
            }

            computeDayColor += '\
        return color;\n\
    }';

            fs.sources.push(computeDayColor);

            vs.sources.push(getPositionMode(sceneMode));
            vs.sources.push(get2DYPositionFraction(useWebMercatorProjection));

            var shader = ShaderProgram.fromCache({
                context : frameState.context,
                vertexShaderSource : vs,
                fragmentShaderSource : fs,
                attributeLocations : terrainEncoding.getAttributeLocations()
            });

            surfaceShader = shadersByFlags[flags] = new GlobeSurfaceShader(numberOfDayTextures, flags, this.material, shader, currentClippingShaderState);
        }

        surfaceTile.surfaceShader = surfaceShader;
        return surfaceShader.shaderProgram;
    };

    GlobeSurfaceShaderSet.prototype.getPickShaderProgram = function(frameState, surfaceTile, useWebMercatorProjection) {
        var quantization = 0;
        var quantizationDefine = '';

        var terrainEncoding = surfaceTile.pickTerrain.mesh.encoding;
        var quantizationMode = terrainEncoding.quantization;
        if (quantizationMode === TerrainQuantization.BITS12) {
            quantization = 1;
            quantizationDefine = 'QUANTIZATION_BITS12';
        }

        var sceneMode = frameState.mode;
        var flags = sceneMode | (useWebMercatorProjection << 2) | (quantization << 3);
        var pickShader = this._pickShaderPrograms[flags];

        if (!defined(pickShader)) {
            var vs = this.baseVertexShaderSource.clone();
            vs.defines.push(quantizationDefine);
            vs.sources.push(getPositionMode(sceneMode));
            vs.sources.push(get2DYPositionFraction(useWebMercatorProjection));

            // pass through fragment shader. only depth is rendered for the globe on a pick pass
            var fs =
                'void main()\n' +
                '{\n' +
                '    gl_FragColor = vec4(1.0, 1.0, 0.0, 1.0);\n' +
                '}\n';

            pickShader = this._pickShaderPrograms[flags] = ShaderProgram.fromCache({
                context : frameState.context,
                vertexShaderSource : vs,
                fragmentShaderSource : fs,
                attributeLocations : terrainEncoding.getAttributeLocations()
            });
        }

        return pickShader;
    };

    GlobeSurfaceShaderSet.prototype.destroy = function() {
        var flags;
        var shader;

        var shadersByTexturesFlags = this._shadersByTexturesFlags;
        for (var textureCount in shadersByTexturesFlags) {
            if (shadersByTexturesFlags.hasOwnProperty(textureCount)) {
                var shadersByFlags = shadersByTexturesFlags[textureCount];
                if (!defined(shadersByFlags)) {
                    continue;
                }

                for (flags in shadersByFlags) {
                    if (shadersByFlags.hasOwnProperty(flags)) {
                        shader = shadersByFlags[flags];
                        if (defined(shader)) {
                            shader.shaderProgram.destroy();
                        }
                    }
                }
            }
        }

        var pickShaderPrograms = this._pickShaderPrograms;
        for (flags in pickShaderPrograms) {
            if (pickShaderPrograms.hasOwnProperty(flags)) {
                shader = pickShaderPrograms[flags];
                shader.destroy();
            }
        }

        return destroyObject(this);
    };

    return GlobeSurfaceShaderSet;
});
