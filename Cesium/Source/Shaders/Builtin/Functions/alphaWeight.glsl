/**
 * @private
 */
float czm_alphaWeight(float a)
{
    float x = 2.0 * (gl_FragCoord.x - czm_viewport.x) / czm_viewport.z - 1.0;
    float y = 2.0 * (gl_FragCoord.y - czm_viewport.y) / czm_viewport.w - 1.0;
    float z = (gl_FragCoord.z - czm_viewportTransformation[3][2]) / czm_viewportTransformation[2][2];
    vec4 q = vec4(x, y, z, 0.0);
    q /= gl_FragCoord.w;

    if (czm_inverseProjection != mat4(0.0)) {
        q = czm_inverseProjection * q;
    } else {
        float top = czm_frustumPlanes.x;
        float bottom = czm_frustumPlanes.y;
        float left = czm_frustumPlanes.z;
        float right = czm_frustumPlanes.w;

        float near = czm_currentFrustum.x;
        float far = czm_currentFrustum.y;

        q.x = (q.x * (right - left) + left + right) * 0.5;
        q.y = (q.y * (top - bottom) + bottom + top) * 0.5;
        q.z = (q.z * (near - far) - near - far) * 0.5;
        q.w = 1.0;
    }

    // See Weighted Blended Order-Independent Transparency for examples of different weighting functions:
    // http://jcgt.org/published/0002/02/09/    
    return pow(a + 0.01, 4.0) + max(1e-2, min(3.0 * 1e3, 0.003 / (1e-5 + pow(abs(z) / 200.0, 4.0))));
}