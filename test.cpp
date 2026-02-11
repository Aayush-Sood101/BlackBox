#include <iostream>
#include <vector>
#include <algorithm>
#include <iterator>

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);
    int n;
    std::cin >> n;
    std::vector<int> arr(n);
    for (int i = 0; i < n; ++i) {
        std::cin >> arr[i];
    }
    int target;
    std::cin >> target;

    // Using std::lower_bound for binary search
    // lower_bound returns an iterator to the first element not less than target
    auto it = std::lower_bound(arr.begin(), arr.end(), target);

    if (it != arr.end() && *it == target) {
        // If the iterator is not at the end and the element it points to is the target,
        // then the target is found. Calculate its 0-based index.
        std::cout << std::distance(arr.begin(), it) << std::endl;
    } else {
        // Otherwise, the target is not found in the array.
        std::cout << -1 << std::endl;
    }

    return 0;
}