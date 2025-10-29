using UnityEngine;
using System.Runtime.InteropServices;


public class RedditBridge : MonoBehaviour
{
    [DllImport("__Internal")]
    private static extern string GetUserAvatar();

    void Start()
    {
        string avatarUrl = GetUserAvatar();
        Debug.Log("User avatar URL: " + avatarUrl);
        // You can then load it into a texture, sprite, etc.
    }
}